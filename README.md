# KAIWU-AI Organization Website

这是 [KAIWU-AI](https://github.com/KAIWU-AI) 的官方 GitHub Pages 组织主页，主要介绍面向教育领域的 AI 视频生成产品 MindMotion。MindMotion 可生成 3D 场景、数字人场景及多样化教育视频。

This is the official GitHub Pages website for [KAIWU-AI](https://github.com/KAIWU-AI), introducing MindMotion, an AI video generation product for education that creates 3D scenes, digital human presenters, and diverse learning scenarios.

MindMotion 的 Logo、紫色品牌 token 与连续工作台视觉语言来自 AgentV 已合并的 [PR #24](https://github.com/KAIWU-AI/AgentV/pull/24)，官网仅做品牌与界面语言融合，保留原有核心布局和 3D 交互。资源来源、固定提交、SHA-256 与适配边界见 [`docs/mindmotion-brand-integration.md`](./docs/mindmotion-brand-integration.md)。

## 本地预览 / Local preview

站点是零构建依赖的静态页面，并在 `vendor/` 中本地托管固定版本的 Three.js，用于太阳系、行星齿轮箱和万向节 3D 教学场景。克隆仓库后，请在仓库根目录启动任意静态文件服务器：

The site has no build dependencies and vendors a pinned Three.js runtime in `vendor/` for the solar system, planetary gearbox, and universal joint learning scenes. Run any static file server from the repository root:

```bash
python -m http.server 8000
```

然后访问：

`http://localhost:8000`

Then open <http://localhost:8000>.

## Web 体验 / Web experience

访问 `/try/` 可体验 MindMotion 从教学主题理解、讲解结构规划到视觉场景建议的创作流程。体验页完全在浏览器本地运行，使用内置模板生成演示方案，不登录、不上传、不保存用户输入，也不会生成或导出真实视频。真实生成、项目编辑、本地素材接入和视频导出能力需下载安装桌面版。

Open `/try/` to explore MindMotion's topic analysis, lesson structuring, and visual scene planning flow. The experience runs locally in the browser with preset demo templates: it requires no sign-in, uploads or persistent storage, and does not generate or export a real video. Full creation capabilities are available in the desktop app.

## 教师与团队数字人 / Digital presenters and builders

首页工作流使用张老师、蔡老师和校友导师刘师兄的数字人形象，按“张老师 → 蔡老师 → 刘师兄”的顺序展示。核心能力之后以真实团队合影为视觉依据，将 12 位开发同学的数字人形象组合在同一个合影舞台中，并使用指定素材呈现瑞高与颜月明。网页使用从原始人物设定图裁出的轻量 JPEG：首屏教师图每张小于 100 KB，团队图延迟加载，不直接分发多视角原始大图。

The homepage workflow presents digital representations of Teacher Zhang, Teacher Cai, and alumni mentor Liu in that order. After the capabilities section, a shared portrait stage brings 12 builder avatars together, guided by the real team photo and using the selected portraits for Ruigao and Yan Yueming. The website serves lightweight crops rather than the original multi-view source sheets, with lazy loading for team imagery.

## 3D 实验场

首页实验场紧接首屏，三个独立实时 Canvas 采用流式响应布局：宽屏三列、中屏自动换行、手机单列。背景星场先由 CSS 即时呈现，再由首帧 Canvas 补充高密度动态星点。实验场包含：

- **太阳系**：NASA 八大行星真实半径、轨道顺序、公转参数与完整轴倾角；画面明确披露非线性半径、轨道压缩、初始相位和时间均为可视化示意，不是实时星历。
- **行星齿轮箱**：复用 CreatorSkills 中已通过机械真值和成片验证的 `three.planetary-gear-kit`，保持 18T 太阳轮 / 3×12T 行星轮 / 42T 固定齿圈关系。
- **万向节**：复用已验证的 `three.universal-joint-kit`，包含双叉、十字轴、四轴承杯与单十字轴万向节的非匀速输出关系，并覆盖连续输出角在 ±π 边界的展开。
- **交互与可访问性**：支持拖拽、方向键旋转和 `Home` 复位；减弱动态模式会停止持续动画帧。
- **图形兼容**：WebGL2 浏览器使用 Three.js r185；仅支持 WebGL1 的浏览器自动切换至 Three.js r162；完全无法创建 WebGL 上下文时保留三张 CSS 轻量动态视图，不再显示错误空卡。

机械组件以项目本地副本运行，不依赖外部组件库；来源、许可证、目标路径和 SHA-256 记录在 [`.creator-components.json`](./.creator-components.json)。太阳系数据与视觉映射位于 [`components/solar-system-data.mjs`](./components/solar-system-data.mjs)。

WebGL1 兼容运行时来自官方 npm 包 `three@0.162.0/build/three.module.min.js`（MIT），本地文件为 `vendor/three-r162.module.min.js`，SHA-256：`ecd9f6b9bc1a12efdf14d13e4c610c012903c141a77d967d3f500bc727f0896c`。

数据来源：

- [NASA · About the Planets](https://science.nasa.gov/solar-system/planets/)
- [NASA · Planet Sizes and Locations in Our Solar System](https://science.nasa.gov/solar-system/planet-sizes-and-locations-in-our-solar-system/)

## 验证

无需安装 npm 依赖：

```bash
node --test tests/*.test.mjs
```

测试覆盖八大行星次序、可视化比例映射、组件 SHA-256，以及齿轮箱和万向节运动学契约。GitHub Pages 部署工作流会在发布前运行同一门禁。

## 发布 / Deployment

推送到 `main` 分支后，`.github/workflows/pages.yml` 会通过 GitHub Actions 发布仓库根目录至 GitHub Pages。

Pushes to `main` are deployed from the repository root by the GitHub Actions workflow in `.github/workflows/pages.yml`.
