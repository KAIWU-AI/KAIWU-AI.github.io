# KAIWU-AI Organization Website

这是 [KAIWU-AI](https://github.com/KAIWU-AI) 的官方 GitHub Pages 组织主页，主要介绍面向教育领域的 AI 视频生成产品 AgentV。AgentV 可生成 3D 场景、数字人场景及多样化教育视频。

This is the official GitHub Pages website for [KAIWU-AI](https://github.com/KAIWU-AI), introducing AgentV, an AI video generation product for education that creates 3D scenes, digital human presenters, and diverse learning scenarios.

## 本地预览 / Local preview

站点是零构建依赖的静态页面。克隆仓库后，可直接打开 `index.html`，或在仓库根目录启动任意静态文件服务器：

The site has no build dependencies. Open `index.html` directly, or run any static file server from the repository root:

```bash
python -m http.server 8000
```

然后访问 <http://localhost:8000>。

Then open <http://localhost:8000>.

## 发布 / Deployment

推送到 `main` 分支后，`.github/workflows/pages.yml` 会通过 GitHub Actions 发布仓库根目录至 GitHub Pages。

Pushes to `main` are deployed from the repository root by the GitHub Actions workflow in `.github/workflows/pages.yml`.
