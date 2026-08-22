# MindMotion 官网品牌融合方案

## 目标

将官网面向用户的 AgentV 品牌完整替换为 MindMotion，同时保持现有页面的信息架构、首屏双栏布局、3D 实验场顺序、Three.js 交互、响应式行为和零构建依赖。

## 上游来源

- 仓库：`KAIWU-AI/AgentV`
- PR：[#24 · 中期课题 UI 交付版 0822 — MindMotion 连续工作台界面](https://github.com/KAIWU-AI/AgentV/pull/24)
- 合并提交：`c038395b3362ba12d4d698348c3825e6ea1c061d`
- 复用资源：`assets/mindmotion-logo.svg`
- 上游资源 SHA-256：`0b5f7c73cf8e12280643583584ade4ab233f49c6ab84e286f085c029d1da528f`

## 融合策略

### 保持不变

1. `top → lab → mission → directions → projects` 的核心页面流程。
2. 太阳系、行星齿轮箱、万向节三张实时 3D 卡片及其数据和运动逻辑。
3. 首屏左侧产品价值、右侧生成工作流的双栏构图。
4. 桌面、中屏、移动端的现有断点和导航交互。
5. WebGL2、WebGL1 与 CSS lite fallback 的渐进增强链路。

### 直接复用

1. PR #24 的官方 MindMotion SVG Logo，保持字节一致。
2. 品牌渐变：`#8b5cf6 → #5b21b6`，方向 `135deg`。
3. 深色紫调表面：`#100f16 / #141219 / #1c1a26`。
4. 品牌主色 `#8b5cf6`；小号文本使用 `#a78bfa`，白字操作按钮使用 `#7c3aed`，避免将品牌色直接用于不满足 AA 的小字号组合。
5. MindMotion + `by KAIWU-AI` 的品牌锁定关系。

### 适配而非照搬

PR #24 是连续工作台，官网是内容型产品首页。因此不复制工作台的侧栏、会话列表、输入框和主题切换；只融合品牌资产、紫色 token、直角化界面语言、字体层级和状态细节。Logo 保持圆角，主要按钮和内容面板收敛为 2px 圆角，但不改变任何布局尺寸和 DOM 功能结构。

## 文案与元数据

- 所有公开可见的 `AgentV` / `AGENTV` 替换为 `MindMotion` / `MINDMOTION`。
- `<title>`、description、Open Graph、Twitter metadata、JSON-LD、favicon 同步更新。
- KAIWU-AI 继续作为产品所属组织，不更改组织名、GitHub 链接和版权主体。
- 运行时错误信息同步使用 MindMotion，避免旧品牌在控制台和无图形 fallback 中泄漏。

## 验收

- 自动化测试确认公开页面和运行时不存在旧产品名。
- 官方 Logo 的 SHA-256 与 PR #24 源文件一致。
- section 顺序和三个 `data-three-view` 不变。
- 本地静态服务器下完成桌面与移动端截图、控制台检查和 3D fallback/交互检查。
