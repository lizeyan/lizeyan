const REPO = "lizeyan/lizeyan";
const BRANCH = "master";
const MANIFEST_URL = "./manifest.json";

const treeEl = document.querySelector("#article-tree");
const contentEl = document.querySelector("#article-content");
const metaEl = document.querySelector("#article-meta");
const refreshButton = document.querySelector("#refresh-tree");
const FOLDER_LABELS = {
  // 各字段把仓库目录名映射成文章归档中面向读者的中文分类名。
  "faultscout-agent-series": "从零开发诊断 Agent",
  "log-parsing": "日志解析",
  "metric-drilldown": "指标下钻定位",
  "python-async": "Python 异步化",
  "time-series-anomaly-detection": "时序异常检测",
};

let articlesByPath = new Map();

marked.setOptions({
  // gfm 字段启用 GitHub Flavored Markdown，保持表格和任务列表的显示行为。
  gfm: true,
  // breaks 字段关闭普通换行转 <br>，避免文章段落被意外切碎。
  breaks: false,
  // mangle 字段关闭标题文本混淆，确保中文标题可读。
  mangle: false,
  // headerIds 字段为标题生成锚点，便于长文内部定位。
  headerIds: true,
});

mermaid.initialize({
  // startOnLoad 字段关闭自动扫描，由文章加载流程统一触发渲染。
  startOnLoad: false,
  // securityLevel 字段允许文章中的常规链接和富文本图表语法。
  securityLevel: "loose",
  // theme 字段使用默认主题，与当前页面样式保持一致。
  theme: "default",
});

/** 去掉文章开头的 YAML 元数据，避免它作为分隔线和正文显示。 */
function stripFrontmatter(markdown) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

/** 把文章路径插入目录树，叶子节点保留标题和完整路径。 */
function insertArticle(root, parts, article) {
  const [head, ...rest] = parts;
  if (!head) return;
  if (rest.length === 0) {
    root.files.push(article);
    return;
  }
  if (!root.children[head]) {
    root.children[head] = { name: head, children: {}, files: [] };
  }
  insertArticle(root.children[head], rest, article);
}

/** 根据文章清单构建可递归渲染的目录树。 */
function buildTree(articles) {
  const root = { name: "articles", children: {}, files: [] };
  for (const article of [...articles].sort((left, right) => left.path.localeCompare(right.path))) {
    const parts = article.path.replace(/^articles\//, "").split("/");
    insertArticle(root, parts, article);
  }
  return root;
}

/** 递归渲染目录节点，并为文章链接绑定无刷新加载行为。 */
function renderTreeNode(node) {
  const list = document.createElement("ul");
  const children = Object.values(node.children).sort((left, right) => left.name.localeCompare(right.name));

  for (const child of children) {
    const item = document.createElement("li");
    const label = document.createElement("div");
    label.className = "tree-folder";
    label.textContent = FOLDER_LABELS[child.name] || child.name;
    item.appendChild(label);
    item.appendChild(renderTreeNode(child));
    list.appendChild(item);
  }

  for (const article of node.files.sort((left, right) => left.path.localeCompare(right.path))) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${encodeURIComponent(article.path)}`;
    link.dataset.path = article.path;
    link.textContent = article.title;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      loadArticle(article.path, { updateHash: true });
    });
    item.appendChild(link);
    list.appendChild(item);
  }
  return list;
}

/** 读取已提交的文章清单；清单由内容脚本生成并由 CI 防止漂移。 */
async function listArticles() {
  const response = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`文章清单加载失败：HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.articles)) throw new Error("文章清单缺少 articles 数组");
  return data.articles;
}

/** 在本地读取静态文件，在生产环境读取 GitHub raw 源文件以绕过 Jekyll 转换。 */
async function fetchArticleMarkdown(articlePath) {
  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
  const url = isLocal
    ? `/${articlePath}`
    : `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${articlePath}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

/** 修正正文中的相对图片与 Markdown 文章链接，使它们适配 hash 路由。 */
function fixRelativeLinks(container, markdownPath) {
  const baseDir = markdownPath.split("/").slice(0, -1).join("/");
  container.querySelectorAll("img").forEach((image) => {
    const source = image.getAttribute("src") || "";
    if (/^(https?:|data:|\/)/.test(source)) return;
    image.src = `/${baseDir}/${source}`.replace(/\/+/g, "/");
  });

  container.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href") || "";
    if (!href.endsWith(".md") || /^(https?:|\/)/.test(href)) return;
    const nextPath = `${baseDir}/${href}`.replace(/\/\.\//g, "/");
    anchor.href = `#${encodeURIComponent(nextPath)}`;
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      loadArticle(nextPath, { updateHash: true });
    });
  });
}

/** 将 Markdown 中的 Mermaid 代码块替换成 SVG；失败时抛错交给拨测发现。 */
async function renderMermaid(container) {
  const blocks = [...container.querySelectorAll("pre code.language-mermaid")];
  let index = 0;
  for (const block of blocks) {
    index += 1;
    const source = block.textContent;
    const wrapper = document.createElement("div");
    wrapper.className = "mermaid";
    const { svg } = await mermaid.render(`mermaid-${Date.now()}-${index}`, source);
    wrapper.innerHTML = svg;
    block.closest("pre").replaceWith(wrapper);
  }
}

/** 使用页面实际加载的 MathJax 渲染行内和块级公式。 */
async function renderMath(container) {
  if (!window.MathJax?.typesetPromise) throw new Error("MathJax 尚未加载");
  await window.MathJax.typesetPromise([container]);
}

/** 更新目录当前选中状态。 */
function setActive(articlePath) {
  treeEl.querySelectorAll("a").forEach((link) => {
    link.classList.toggle("active", link.dataset.path === articlePath);
  });
}

/** 加载、渲染并定位一篇文章；渲染失败时在页面上给出可拨测的错误状态。 */
async function loadArticle(articlePath, { updateHash = false } = {}) {
  setActive(articlePath);
  metaEl.textContent = articlePath;
  contentEl.innerHTML = "<p class=\"muted\">正在加载文章...</p>";

  try {
    const markdown = await fetchArticleMarkdown(articlePath);
    contentEl.innerHTML = marked.parse(stripFrontmatter(markdown));
    fixRelativeLinks(contentEl, articlePath);
    await renderMermaid(contentEl);
    await renderMath(contentEl);
  } catch (error) {
    console.error("文章加载或渲染失败", error);
    contentEl.innerHTML = `<p class="article-error">无法加载文章：${articlePath}</p>`;
    return;
  }

  if (updateHash) history.replaceState(null, "", `#${encodeURIComponent(articlePath)}`);
  const article = articlesByPath.get(articlePath);
  document.title = `${article?.title || contentEl.querySelector("h1")?.textContent || articlePath} · 文章归档`;
}

/** 初始化文章清单、目录树和 URL hash 指定的首篇文章。 */
async function init() {
  treeEl.innerHTML = "<p class=\"muted\">正在加载文章目录...</p>";
  const articles = await listArticles();
  articlesByPath = new Map(articles.map((article) => [article.path, article]));
  const tree = buildTree(articles);
  treeEl.innerHTML = "";
  treeEl.appendChild(renderTreeNode(tree));

  const hashPath = decodeURIComponent(location.hash.replace(/^#/, ""));
  const initial = articlesByPath.has(hashPath) ? hashPath : articles[0]?.path;
  if (initial) await loadArticle(initial, { updateHash: !hashPath });
}

refreshButton.addEventListener("click", () => {
  init().catch((error) => {
    console.error(error);
    treeEl.innerHTML = "<p class=\"muted\">文章目录加载失败。</p>";
  });
});

init().catch((error) => {
  console.error(error);
  treeEl.innerHTML = "<p class=\"muted\">文章目录加载失败。</p>";
});
