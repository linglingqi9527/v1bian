# AGENTS.md

本文件写给 Codex / AI 开发代理，用来约束后续对 `v1bian` 项目的修改方式。项目产品名为「辩了么」，当前阶段是从 demo 页面过渡到正式项目结构。

## 基本原则

- 不要推倒重写项目。先理解现有 `src` 分层、页面结构和 design-system，再做小步修改。
- 不要随意新增后端、登录、真实爬虫、真实 B 站数据、真实 AI 功能，除非用户明确要求进入这些阶段。
- 不要把正式产品做成长网页、后台管理系统或营销落地页。它应保持固定 app shell：外部背景、居中应用窗口、左侧导航栏、右侧主操作区。
- 大改前先说明计划，小步修改，每一步都要尽量保持项目可运行。
- 每次修改后必须保证 `npm run build` 通过；涉及 lint 风险的修改也应运行 `npm run lint`。

## 代码边界

- `roughjs` 只能在 `src/design-system/handdrawn` 内部 import。
- 不要在 `pages`、`features`、`styles` 中直接 import `roughjs`。
- 不要恢复 `RoughSelectionLayer` 作为主方案。它已废弃，不再依赖全局 DOM 扫描来生成选中态。
- 手绘选中填充统一由 `HandDrawnAnimatedFill` 承担。
- 页面不要直接写边框、active 填充、roughjs 动画、底层 SVG 抖动参数。
- 全站按钮、标签、卡片优先使用 `SketchButton`、`SketchTag`、`SketchCard`。
- 如果发现页面里重复写卡片边框、按钮 active 填充、标签颜色，应优先收口到 design-system，而不是继续在页面里补样式。

## 视觉与素材

- 手绘风格组件必须集中管理，页面不能各自乱写一套手绘样式。
- 插图、图标、logo、纹理统一放在 `src/assets` 下对应目录：
  - `src/assets/illustrations`
  - `src/assets/icons`
  - `src/assets/logo`
  - `src/assets/textures`
  - `src/assets/handdrawn-shapes`
- 用户数据、录音、录像、赛评正文、训练备注不要放进 `src/assets`。
- `src/assets` 只存产品静态素材，不存运行时数据。

## 产品规则

- 核心对象是比赛。赛评和训练都围绕比赛展开。
- 一个比赛对应一个赛评。
- 一个比赛可以对应多个训练。
- 赛评评价比赛，训练备注评价自己，两者不能混在一起。
- 用户主动进入“写赛评”时，应先展示赛评列表，不要直接进入编辑器。
- 用户从比赛详情点击“写赛评”时，可以直接进入该比赛对应的赛评编辑页。
- 用户主动进入“做训练”时，应先展示训练列表，不要直接进入录制页。
- 训练录制结束后不能自动保存，必须先预览，用户点击“保存训练”后才生成训练记录。
- 私人数据需要预留 `userId`，当前统一使用 `demo-user`。

## 修改方式

- 优先复用现有文件结构：`app`、`pages`、`features`、`design-system`、`assets`、`data`、`models`、`hooks`、`styles`。
- 页面层只负责组合场景和路由状态，通用 UI、手绘边框、选中填充、动画应下沉到 design-system。
- 业务数据读取、匹配、创建、保存逻辑应放在 `features` 或 `store`，不要散落在 UI 组件中。
- 不要把 demo mock 数据和未来用户数据混入静态素材目录。
