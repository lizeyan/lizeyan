import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { unified } from "unified";
import remarkFrontmatter from "remark-frontmatter";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import YAML from "yaml";

const REPO_ROOT = process.cwd();
const ARTICLES_DIR = path.join(REPO_ROOT, "articles");
const MANIFEST_PATH = path.join(ARTICLES_DIR, "manifest.json");
const WRITE_MANIFEST = process.argv.includes("--write-manifest");

/** 递归枚举目录中的 Markdown 文件，并返回相对仓库根目录的稳定路径。 */
async function listMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listMarkdownFiles(absolutePath);
    if (!entry.isFile() || !entry.name.endsWith(".md")) return [];
    return [path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/")];
  }));
  return nested.flat().sort();
}

/** 解析文章 YAML 元数据，并保留正文供标题和链接校验使用。 */
function parseArticleSource(source, articlePath) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`${articlePath}: 缺少文件开头的 YAML frontmatter`);

  let metadata;
  try {
    metadata = YAML.parse(match[1]);
  } catch (error) {
    throw new Error(`${articlePath}: YAML 元数据无法解析：${error.message}`);
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(`${articlePath}: YAML 元数据必须是键值对象`);
  }
  return { metadata, body: source.slice(match[0].length) };
}

/** 校验单篇文章的标题、精选字段、Markdown 结构和本地资源引用。 */
async function validateArticle(articlePath) {
  const absolutePath = path.join(REPO_ROOT, articlePath);
  const source = await readFile(absolutePath, "utf8");
  const { metadata, body } = parseArticleSource(source, articlePath);
  const errors = [];

  if (typeof metadata.title !== "string" || metadata.title.trim() === "") {
    errors.push("title 必须是非空字符串");
  }
  if (typeof metadata.featured !== "boolean") {
    errors.push("featured 必须是 YAML 布尔值 true 或 false");
  }
  if (metadata.featured === true && (!Number.isInteger(metadata.featured_order) || metadata.featured_order <= 0)) {
    errors.push("精选文章必须提供正整数 featured_order");
  }
  if (metadata.featured !== true && Object.hasOwn(metadata, "featured_order")) {
    errors.push("非精选文章不应设置 featured_order");
  }

  const tree = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkMath).parse(body);
  const headings = [];
  const localReferences = [];
  visit(tree, "heading", (node) => {
    if (node.depth !== 1) return;
    const title = node.children.filter((child) => child.type === "text" || child.type === "inlineCode")
      .map((child) => child.value)
      .join("")
      .trim();
    headings.push(title);
  });
  visit(tree, (node) => node.type === "link" || node.type === "image", (node) => {
    if (!node.url || /^(?:[a-z]+:|#|\/)/i.test(node.url)) return;
    localReferences.push(node.url.split(/[?#]/, 1)[0]);
  });

  if (headings.length !== 1) errors.push(`正文必须且只能有一个一级标题，当前为 ${headings.length} 个`);
  if (headings[0] && metadata.title !== headings[0]) {
    errors.push(`元数据 title 与正文一级标题不一致：${JSON.stringify(metadata.title)} != ${JSON.stringify(headings[0])}`);
  }

  for (const reference of localReferences) {
    const targetPath = path.resolve(path.dirname(absolutePath), decodeURIComponent(reference));
    try {
      await readFile(targetPath);
    } catch {
      errors.push(`本地资源不存在：${reference}`);
    }
  }

  if (errors.length > 0) throw new Error(`${articlePath}:\n  - ${errors.join("\n  - ")}`);
  return {
    path: articlePath,
    title: metadata.title,
    featured: metadata.featured,
    ...(metadata.featured ? { featuredOrder: metadata.featured_order } : {}),
  };
}

/** 生成首页和文章归档共同使用的确定性文章索引。 */
function buildManifest(articles) {
  return {
    // articles 字段记录每篇文章的公开路径、标题和精选状态。
    articles: articles.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

/** 校验精选顺序唯一，避免首页目录在不同构建中出现不确定排序。 */
function validateFeaturedOrders(articles) {
  const seen = new Map();
  for (const article of articles.filter((item) => item.featured)) {
    const previous = seen.get(article.featuredOrder);
    if (previous) {
      throw new Error(`featured_order ${article.featuredOrder} 重复：${previous} 与 ${article.path}`);
    }
    seen.set(article.featuredOrder, article.path);
  }
}

/** 执行内容校验；按参数写入索引，或确认已提交索引与文章元数据一致。 */
async function main() {
  const paths = await listMarkdownFiles(ARTICLES_DIR);
  const articles = [];
  const failures = [];
  for (const articlePath of paths) {
    try {
      articles.push(await validateArticle(articlePath));
    } catch (error) {
      failures.push(error.message);
    }
  }
  if (failures.length > 0) throw new Error(failures.join("\n"));

  validateFeaturedOrders(articles);
  const expected = `${JSON.stringify(buildManifest(articles), null, 2)}\n`;
  if (WRITE_MANIFEST) {
    await writeFile(MANIFEST_PATH, expected, "utf8");
    console.log(`已更新 ${path.relative(REPO_ROOT, MANIFEST_PATH)}`);
    return;
  }

  const actual = await readFile(MANIFEST_PATH, "utf8");
  if (actual !== expected) {
    throw new Error("articles/manifest.json 与文章元数据不一致，请运行 npm run manifest:update");
  }
  console.log(`内容校验通过：${articles.length} 篇文章，${articles.filter((article) => article.featured).length} 篇精选文章。`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
