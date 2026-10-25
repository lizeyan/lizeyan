import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { unified } from "unified";
import remarkFrontmatter from "remark-frontmatter";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";

const REPO_ROOT = process.cwd();
const baseUrlArgument = process.argv.find((argument) => argument.startsWith("--base-url="));
const requestedBaseUrl = baseUrlArgument?.slice("--base-url=".length).replace(/\/$/, "");
const MIME_TYPES = {
  // 各字段把静态文件扩展名映射为浏览器正确解析所需的 Content-Type。
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/** 启动只服务仓库文件的本地 HTTP 服务器，供浏览器执行真实前端渲染。 */
async function startStaticServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      let filePath = path.resolve(REPO_ROOT, `.${pathname}`);
      if (!filePath.startsWith(`${REPO_ROOT}${path.sep}`) && filePath !== REPO_ROOT) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const fileStat = await stat(filePath);
      if (fileStat.isDirectory()) filePath = path.join(filePath, "index.html");
      const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      response.writeHead(200, { "Content-Type": contentType });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not Found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

/** 统计一篇 Markdown 中需要浏览器实际渲染的数学公式和 Mermaid 图数量。 */
async function inspectArticleSource(articlePath) {
  const source = await readFile(path.join(REPO_ROOT, articlePath), "utf8");
  const tree = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkMath).parse(source);
  let mathCount = 0;
  let mermaidCount = 0;
  visit(tree, (node) => node.type === "math" || node.type === "inlineMath", () => { mathCount += 1; });
  visit(tree, "code", (node) => { if (node.lang === "mermaid") mermaidCount += 1; });
  return { mathCount, mermaidCount };
}

/** 为一个页面收集脚本异常和关键资源加载失败，并在测试结束时统一报告。 */
function collectPageErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`页面异常：${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error：${message.text()}`);
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (response.status() >= 400 && ["http:", "https:"].includes(url.protocol)) {
      errors.push(`资源 ${response.status()}：${response.url()}`);
    }
  });
  return errors;
}

/** 检查页面加载完成且没有浏览器异常。 */
async function assertHealthyPage(browser, url, selector) {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);
  const response = await page.goto(url, { waitUntil: "networkidle" });
  if (!response?.ok()) errors.push(`主文档响应异常：${response?.status()}`);
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 20_000 });
  const title = await page.title();
  if (!title.trim()) errors.push("页面 title 为空");
  await page.close();
  if (errors.length > 0) throw new Error(`${url}\n  - ${errors.join("\n  - ")}`);
}

/** 检查买房与租房工具的默认报告和一次情景切换均能正常工作。 */
async function checkBuyVsRent(browser, baseUrl) {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);
  const response = await page.goto(`${baseUrl}/BuyVsRentReport/`, { waitUntil: "networkidle" });
  if (!response?.ok()) errors.push(`主文档响应异常：${response?.status()}`);
  await page.locator("#paramsForm input").first().waitFor({ state: "visible" });
  if (await page.locator("#kpiGrid .kpi").count() === 0) errors.push("默认 KPI 未生成");
  if (await page.locator("#detailRows tr").count() === 0) errors.push("年度明细未生成");
  const scenario = page.locator(".scenario-button").first();
  if (await scenario.count()) await scenario.click();
  if ((await page.locator("#errorBox").innerText()).trim()) errors.push("默认或情景参数产生错误提示");
  await page.close();
  if (errors.length > 0) throw new Error(`BuyVsRentReport 拨测失败\n  - ${errors.join("\n  - ")}`);
}

/** 逐篇打开 hash 路由，验证 Markdown、Mermaid 与 MathJax 的真实渲染结果。 */
async function checkArticles(browser, baseUrl, articles) {
  for (const article of articles) {
    const page = await browser.newPage();
    const errors = collectPageErrors(page);
    const { mathCount, mermaidCount } = await inspectArticleSource(article.path);
    const url = `${baseUrl}/articles/#${encodeURIComponent(article.path)}`;
    const response = await page.goto(url, { waitUntil: "networkidle" });
    if (!response?.ok()) errors.push(`主文档响应异常：${response?.status()}`);
    await page.locator("#article-meta").filter({ hasText: article.path }).waitFor({ state: "visible", timeout: 30_000 });
    await page.locator("#article-content h1").waitFor({ state: "visible", timeout: 30_000 });

    const renderedTitle = (await page.locator("#article-content h1").innerText()).trim();
    if (renderedTitle !== article.title) errors.push(`标题不一致：${renderedTitle} != ${article.title}`);
    if (await page.locator(".article-error, mjx-merror").count()) errors.push("正文包含加载或数学公式错误");
    if (await page.locator(".mermaid svg").count() !== mermaidCount) errors.push("Mermaid 图未全部渲染为 SVG");
    if (await page.locator("mjx-container").count() < mathCount) errors.push("MathJax 公式渲染数量少于 Markdown 公式数量");
    await page.close();
    if (errors.length > 0) throw new Error(`${article.path}\n  - ${errors.join("\n  - ")}`);
  }
}

/** 验证生产首页的精选目录与 manifest 中的精选文章完全一致。 */
async function checkFeaturedArticles(browser, baseUrl, articles) {
  const featured = articles.filter((article) => article.featured)
    .sort((left, right) => left.featuredOrder - right.featuredOrder);
  const page = await browser.newPage();
  const errors = collectPageErrors(page);
  const response = await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  if (!response?.ok()) errors.push(`首页响应异常：${response?.status()}`);
  const links = await page.locator("h3#精选文章 + ul a, h3#精选文章 ~ ul:first-of-type a").allTextContents();
  for (const article of featured) {
    if (!links.includes(article.title)) errors.push(`首页缺少精选文章：${article.title}`);
  }
  await page.close();
  if (errors.length > 0) throw new Error(`首页精选目录拨测失败\n  - ${errors.join("\n  - ")}`);
}

/** 运行本地内容浏览器检查，或对指定生产域名执行完整拨测。 */
async function main() {
  const manifest = JSON.parse(await readFile(path.join(REPO_ROOT, "articles/manifest.json"), "utf8"));
  const localServer = requestedBaseUrl ? null : await startStaticServer();
  const baseUrl = requestedBaseUrl || localServer.baseUrl;
  const browser = await chromium.launch({ headless: true });
  try {
    await assertHealthyPage(browser, `${baseUrl}/articles/`, "#article-tree a");
    await checkArticles(browser, baseUrl, manifest.articles);
    await checkBuyVsRent(browser, baseUrl);
    if (requestedBaseUrl) {
      await assertHealthyPage(browser, `${baseUrl}/`, "h1");
      await checkFeaturedArticles(browser, baseUrl, manifest.articles);
    }
    console.log(`浏览器检查通过：${manifest.articles.length} 篇文章，目标 ${baseUrl}`);
  } finally {
    await browser.close();
    if (localServer) await new Promise((resolve) => localServer.server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
