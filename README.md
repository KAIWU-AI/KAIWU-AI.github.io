# KAIWU-AI Organization Website

这是 [KAIWU-AI](https://github.com/KAIWU-AI) 的官方 GitHub Pages 组织主页，主要介绍面向教育领域的 AI 视频生成产品 AgentV。AgentV 可生成 3D 场景、数字人场景及多样化教育视频。

This is the official GitHub Pages website for [KAIWU-AI](https://github.com/KAIWU-AI), introducing AgentV, an AI video generation product for education that creates 3D scenes, digital human presenters, and diverse learning scenarios.

## 本地预览 / Local preview

站点是零构建依赖的静态页面，并在 `vendor/` 中本地托管固定版本的 Three.js，用于太阳系、行星齿轮箱和万向节 3D 教学场景。克隆仓库后，请在仓库根目录启动任意静态文件服务器：

The site has no build dependencies and vendors a pinned Three.js runtime in `vendor/` for the solar system, planetary gearbox, and universal joint learning scenes. Run any static file server from the repository root:

```bash
python -m http.server 8000
```

然后访问：

`http://localhost:8000`

Then open <http://localhost:8000>.

## 3D 实验场

首页实验场紧接首屏，三个独立实时 Canvas 采用流式响应布局：宽屏三列、中屏自动换行、手机单列。背景星场先由 CSS 即时呈现，再由首帧 Canvas 补充高密度动态星点。实验场包含：

- **太阳系**：NASA 八大行星真实半径、轨道顺序、公转参数与完整轴倾角；画面明确披露非线性半径、轨道压缩、初始相位和时间均为可视化示意，不是实时星历。
- **行星齿轮箱**：复用 CreatorSkills 中已通过机械真值和成片验证的 `three.planetary-gear-kit`，保持 18T 太阳轮 / 3×12T 行星轮 / 42T 固定齿圈关系。
- **万向节**：复用已验证的 `three.universal-joint-kit`，包含双叉、十字轴、四轴承杯与单十字轴万向节的非匀速输出关系，并覆盖连续输出角在 ±π 边界的展开。
- **交互与可访问性**：支持拖拽、方向键旋转和 `Home` 复位；减弱动态模式会停止持续动画帧。

机械组件以项目本地副本运行，不依赖外部组件库；来源、许可证、目标路径和 SHA-256 记录在 [`.creator-components.json`](./.creator-components.json)。太阳系数据与视觉映射位于 [`components/solar-system-data.mjs`](./components/solar-system-data.mjs)。

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
