# 当前任务状态

## 目标

- 更新首页简历，所有新增事实必须有可靠来源，不能根据推测补写。
- 将指定飞书文档整理为“从零开发诊断 Agent”系列的新文章。
- 通过 Markdown 元数据中的 `featured: true` 控制首页精选文章。
- 增加内容 CI，校验元数据、Markdown、站内资源和数学公式。
- 增加生产站点拨测，覆盖首页、文章归档、每篇文章和现有 H5 子页面。

## 重要约束

- 飞书文档必须通过 `bytedcli lark`（lark-cli）读取；命令前加 `BYTEDCLI_DISABLE_SYSTEM_CA_MERGE=1 BYTEDCLI_NO_AUTO_UPGRADE=1`。
- 不公开飞书底稿中的凭据、内部地址、个人信息或其他不适合公开的内容。
- 新增或修改的代码函数必须有中文注释；新增元数据字段和配置字段必须有中文说明。
- 改动保持最小，不重构与本任务无关的页面。
- 网站验证优先使用内置浏览器；若登录成为必要条件，再请用户完成登录。

## 当前实现假设

- 文章使用标准 YAML frontmatter；`featured: true` 表示在首页展示，`featured_order` 控制顺序。
- GitHub Pages 会处理带 frontmatter 的 Markdown，因此文章归档在生产环境从 GitHub raw 内容读取，避免拿到 Jekyll 生成的 HTML。
- `articles/manifest.json` 是首页和归档共享的已提交索引，由脚本生成并由 CI 检查是否最新。

## 已完成验证

- lark-cli 已切换到 `bytedance_enterprise` 应用配置，并用该应用 Bot 身份读取指定底稿。
- `npm run content:check` 通过：11 篇文章，4 篇精选文章。
- `npm run browser:check` 通过：逐篇验证 Markdown、Mermaid 和 MathJax，并验证现有买房与租房 H5 页面。
- `git diff --check` 通过。
- 生产域名拨测需在分支合并并完成 GitHub Pages 部署后由 `Production Site Monitor` 执行。
