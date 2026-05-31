const REPO = "lizeyan/lizeyan";
const BRANCH = "master";
const ROOT_DIR = "articles";
const FALLBACK_MANIFEST = "./manifest.json";

const treeEl = document.querySelector("#article-tree");
const contentEl = document.querySelector("#article-content");
const metaEl = document.querySelector("#article-meta");
const refreshButton = document.querySelector("#refresh-tree");
const TITLE_OVERRIDES = {
  "articles/bytetech-drilldown/drilldown-from-alert-to-actionable-clues.md": "下钻定位：从指标告警到可执行的排障线索",
  "articles/bytetech-selected/robust-threshold-extreme-value.md": "基于极值理论的鲁棒时间序列自动阈值选取算法",
  "articles/bytetech-selected/adaptive-log-parsing-sigmod25.md": "ByteBrain 团队 SIGMOD25：云服务中的高效、自适应日志解析",
  "articles/bytetech-selected/time-series-threshold-extreme-value.md": "时序异常检测：基于极值理论的阈值选择",
  "articles/bytetech-selected/python-service-async-migration.md": "大型 Python 服务的异步改造：经验总结与最佳实践",
  "articles/faultscout-agent-series/01-motivation-and-startup.md": "从零开发诊断 Agent（一）：为什么我们要做 FaultScout",
  "articles/faultscout-agent-series/02-diagnostic-tool-design.md": "从零开发诊断 Agent（二）：工具和上下文要一起设计",
  "articles/faultscout-agent-series/03-investigation-tree.md": "从零开发诊断 Agent（三）：为什么诊断过程需要一棵排障树",
  "articles/faultscout-agent-series/04-feishu-progress-update.md": "从零开发诊断 Agent（四）：最终结论之前，先进展同步",
  "articles/faultscout-agent-series/05-diagnosis-graph-and-query-templates.md": "从零开发诊断 Agent（五）：把一次次查询沉淀成模板和排障图",
};
const FOLDER_LABELS = {
  "bytetech-drilldown": "ByteTech 下钻定位",
  "bytetech-selected": "ByteTech 精选文章",
  "faultscout-agent-series": "从零开发诊断 Agent",
};

marked.setOptions({
  gfm: true,
  breaks: false,
  mangle: false,
  headerIds: true,
});

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "default",
});

function titleFromPath(path) {
  if (TITLE_OVERRIDES[path]) return TITLE_OVERRIDES[path];
  const name = path.split("/").pop().replace(/\.md$/, "");
  return name
    .replace(/^\d+[-_]?/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function insertPath(root, parts, fullPath) {
  const [head, ...rest] = parts;
  if (!head) return;
  if (rest.length === 0) {
    root.files.push({ name: head, path: fullPath });
    return;
  }
  if (!root.children[head]) {
    root.children[head] = { name: head, children: {}, files: [] };
  }
  insertPath(root.children[head], rest, fullPath);
}

function buildTree(paths) {
  const root = { name: ROOT_DIR, children: {}, files: [] };
  for (const path of paths.sort()) {
    const parts = path.replace(`${ROOT_DIR}/`, "").split("/");
    insertPath(root, parts, path);
  }
  return root;
}

function renderTreeNode(node) {
  const ul = document.createElement("ul");

  for (const child of Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name))) {
    const li = document.createElement("li");
    const label = document.createElement("div");
    label.className = "tree-folder";
    label.textContent = FOLDER_LABELS[child.name] || child.name;
    li.appendChild(label);
    li.appendChild(renderTreeNode(child));
    ul.appendChild(li);
  }

  for (const file of node.files.sort((a, b) => a.name.localeCompare(b.name))) {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${encodeURIComponent(file.path)}`;
    link.dataset.path = file.path;
    link.textContent = titleFromPath(file.path);
    link.addEventListener("click", (event) => {
      event.preventDefault();
      loadArticle(file.path, { updateHash: true });
    });
    li.appendChild(link);
    ul.appendChild(li);
  }

  return ul;
}

async function listMarkdownFiles() {
  const readManifest = async () => {
    const response = await fetch(FALLBACK_MANIFEST);
    if (!response.ok) return [];
    const data = await response.json();
    return data.files || [];
  };

  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    return readManifest();
  }

  const apiUrl = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
  try {
    const response = await fetch(apiUrl, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);
    const data = await response.json();
    const files = data.tree
      .filter((item) => item.type === "blob")
      .map((item) => item.path)
      .filter((path) => path.startsWith(`${ROOT_DIR}/`) && path.endsWith(".md"))
      .filter((path) => !path.endsWith("README.md"));
    return files.length > 0 ? files : await readManifest();
  } catch (error) {
    console.warn("Falling back to local manifest", error);
    return readManifest();
  }
}

function fixRelativeLinks(container, markdownPath) {
  const baseDir = markdownPath.split("/").slice(0, -1).join("/");
  container.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") || "";
    if (/^(https?:|data:|\/)/.test(src)) return;
    img.src = `/${baseDir}/${src}`.replace(/\/+/g, "/");
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

async function renderMermaid(container) {
  const blocks = [...container.querySelectorAll("pre code.language-mermaid")];
  let index = 0;
  for (const block of blocks) {
    index += 1;
    const source = block.textContent;
    const wrapper = document.createElement("div");
    wrapper.className = "mermaid";
    try {
      const { svg } = await mermaid.render(`mermaid-${Date.now()}-${index}`, source);
      wrapper.innerHTML = svg;
      block.closest("pre").replaceWith(wrapper);
    } catch (error) {
      wrapper.textContent = source;
      block.closest("pre").replaceWith(wrapper);
    }
  }
}

function setActive(path) {
  treeEl.querySelectorAll("a").forEach((link) => {
    link.classList.toggle("active", link.dataset.path === path);
  });
}

async function loadArticle(path, { updateHash = false } = {}) {
  setActive(path);
  metaEl.textContent = path;
  contentEl.innerHTML = "<p class=\"muted\">正在加载文章...</p>";

  const response = await fetch(`/${path}`);
  if (!response.ok) {
    contentEl.innerHTML = `<p class="muted">无法加载文章：${path}</p>`;
    return;
  }
  const markdown = await response.text();
  contentEl.innerHTML = marked.parse(markdown);
  fixRelativeLinks(contentEl, path);
  await renderMermaid(contentEl);
  if (updateHash) {
    history.replaceState(null, "", `#${encodeURIComponent(path)}`);
  }
  document.title = `${contentEl.querySelector("h1")?.textContent || titleFromPath(path)} · 文章归档`;
}

async function init() {
  treeEl.innerHTML = "<p class=\"muted\">正在加载文章目录...</p>";
  const files = await listMarkdownFiles();
  const tree = buildTree(files);
  treeEl.innerHTML = "";
  treeEl.appendChild(renderTreeNode(tree));

  const hashPath = decodeURIComponent(location.hash.replace(/^#/, ""));
  const initial = files.includes(hashPath) ? hashPath : files[0];
  if (initial) {
    await loadArticle(initial, { updateHash: !hashPath });
  }
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
