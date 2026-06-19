# 开发记录

## 当前状态

更新时间：2026-06-19

项目 `v1bian` 已创建为 React + Vite 项目，产品名为「辩了么」。项目已上传 GitHub 私有仓库，当前处于从 demo 过渡到正式项目结构的阶段。

## 已完成

- 已建立 React + Vite 基础项目。
- 已建立 `app / pages / features / design-system / assets / data / models / hooks / styles` 分层。
- 已创建固定 app shell 的基础方向：外部背景、居中应用窗口、左侧导航栏、右侧主操作区。
- 已引入明亮手绘风的主要视觉方向。
- 已集中静态素材目录，包括 `illustrations`、`icons`、`logo`、`textures`、`handdrawn-shapes`。
- 已建立 demo 比赛、赛评、训练数据。
- 已建立比赛、赛评、训练、用户模型文件。
- 已建立 matches、reviews、trainings、storage、crawler 等业务 feature 目录。
- `roughjs` 已收口到 `HandDrawnAnimatedFill`。
- `RoughSelectionLayer` 已废弃，不再作为主方案。
- `SketchButton`、`SketchTag`、`SketchCard` 已开始接入统一选中填充。
- 当前 `npm run build` 已能通过。

## 当前重点

- 继续整理 `design-system`，集中边框、动画、颜色、组件入口和素材入口。
- 继续减少页面里直接写按钮、标签、卡片、边框和 active 填充的情况。
- 继续整理 `globals.css` 中遗留的页面 demo 样式。
- 继续把页面 demo 结构拆分为更清晰的业务组件，但不要大规模重写页面。

## 已废弃或不再作为主方案

- `RoughSelectionLayer` 不再作为选中态实现方案。
- 不再依赖全局 DOM 扫描 `.pill--active`、`.tag-blue`、`.match-action-link:first-child` 等选择器来生成手绘填充。
- 页面不应直接处理 roughjs、SVG 或动画细节。

## 下一步建议

1. 优先稳定 `SketchButton`、`SketchTag`、`SketchCard` 的 props 和视觉表现。
2. 将剩余页面中的按钮、标签、卡片逐步迁移到统一组件。
3. 将常用列表项抽成 features 下的业务组件，例如比赛列表项、赛评列表项、训练列表项。
4. 逐步拆分 `globals.css`，把通用视觉收口到 design-system，把页面特定样式留在页面或 feature 层。
5. 在不接后端的前提下，先完善 IndexedDB 的本地保存策略。
