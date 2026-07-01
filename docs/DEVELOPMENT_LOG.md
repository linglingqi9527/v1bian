# 开发记录

## 当前状态

更新时间：2026-06-29

项目 `v1bian` 已创建为 React + Vite 项目，产品名为「辩了么」。当前已经从早期 demo 进入“框架和流程收口”阶段：看比赛页和数据导入已有基础成果，写赛评和做训练仍需继续正式化。

## 已完成

- 已建立 React + Vite 基础项目。
- 已建立 `app / pages / features / design-system / assets / data / models / hooks / styles` 分层。
- 已创建固定 app shell 的基础方向：外部背景、居中应用窗口、左侧导航栏、右侧主操作区。
- 已引入明亮手绘风的主要视觉方向。
- 已集中静态素材目录，包括 `illustrations`、`icons`、`logo`、`textures`、`handdrawn-shapes`。
- 已建立 demo 比赛、赛评、训练数据。
- 已接入 `src/data/generated/generatedMatches.json` 作为比赛卡片主数据来源。
- 已建立 B 站数据导入和辩手识别脚本，当前暂时暂停继续扩展。
- 2024 年 1 月正赛 31 场已写入辩手数据和 `speakerGroups`。
- 已建立比赛、赛评、训练、用户模型文件。
- 已建立 matches、reviews、trainings、storage、crawler 等业务 feature 目录。
- `roughjs` 已收口到 `src/design-system/handdrawn`。
- `RoughSelectionLayer` 已废弃，不再作为主方案。
- `SketchButton`、`SketchTag`、`SketchCard` 已开始接入统一选中填充。
- 当前收藏书签、小状态标签、看比赛页小边框效果较满意，应保留并小步调整。
- 当前 `npm run build` 已能通过。

## 当前重点

- 继续整理 `design-system`，集中边框、动画、颜色、组件入口和素材入口。
- 继续减少页面里直接写按钮、标签、卡片、边框和 active 填充的情况。
- 继续整理 `globals.css` 中遗留的页面 demo 样式。
- 继续把页面 demo 结构拆分为更清晰的业务组件，但不要大规模重写页面。
- 接下来优先处理写赛评和做训练流程，不要继续扩大爬虫任务。

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
