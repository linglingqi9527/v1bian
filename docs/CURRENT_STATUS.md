# 当前状态

更新时间：2026-06-30

本文件记录项目当前真实状态，避免新对话只读早期 README 后误判项目进度。

## 总体阶段

`v1bian` 已经不是空 demo。当前状态是：

- 看比赛页面已有较成熟的视觉、数据和交互。
- 写赛评主链路已完成十之八九，正在做文件收口。
- 做训练、我的页面仍以 demo / 占位为主。
- 爬虫和辩手识别数据管线已有阶段性成果，但当前暂停扩展。
- 下一阶段应回到前端框架、页面结构、赛评和训练流程收口。

## 看比赛页面

当前相对成熟：

- 比赛卡片已经使用生成数据源。
- 搜索栏可按辩题、学校、辩手等信息搜索。
- 筛选项为 `全部 / 已看 / 收藏`。
- 收藏书签可以切换收藏状态。
- 点击观看比赛或辩题可打开 B 站链接，并标记已看。
- 点击 `未看 / 已看` 状态标签可切换已看状态。
- 状态可通过本地保存保留。
- 卡片支持 `speakerGroups`，可按正反方显示辩手。

当前仍需打磨：

- 右侧操作按钮的图标、文字对齐。
- 比赛卡片右侧小竖杠。
- 大面积 hachure 选中填充真实度。
- 左侧导航整体比例和细节。
- 小字层级、密度和留白。

## 数据现状

当前 `src/data/generated/generatedMatches.json` 已接入页面。

截至 2026-06-29：

- 生成比赛卡片：约 379 条。
- 有辩手数据：约 272 条。
- 有正反方 `speakerGroups`：约 125 条。
- 覆盖年份：2023、2024、2025、2026。
- 2024 年 1 月正赛：31 场已全部写入卡片；总辩手 216 人；15 场完整 8 人；28 场达到 6 人以上。

数据管线文件主要在：

- `scripts/crawler/bilibili`
- `scripts/crawler/bilibili/speakerEnrichment`
- `src/data/generated`

注意：

- 当前不要继续扩展爬虫和语音识别，除非用户明确进入数据阶段。
- 不要在前端页面实时请求 B 站。
- 不要把音频缓存、转写缓存、用户数据放进 `src/assets`。

## 页面功能完成度

相对成熟：

- `MatchesPage`：看比赛主页面，已有数据和主要交互。

已经进入收口：

- `ReviewsPage`：赛评列表已接入本地赛评数据、搜索、状态筛选、重要性颜色筛选和颜色快速编辑；标题和编辑按钮进入统一编辑页。
- `ReviewEditorPage`：已支持从比赛创建/编辑对应赛评、私人新建赛评、自动保存、手动保存、草稿/已完成状态、目录和基础富文本编辑。

仍是 demo / 占位：

- `ReviewDetailPage`：暂不作为正式入口；列表里的“查看赛评”已移除。后续统一清查时再决定删除、重定向或改造。
- `TrainingsPage`：训练列表仍偏 demo。
- `TrainingCreatePage`：录制/预览/保存流程还不是正式功能。
- `TrainingDetailPage`：详情能力未正式完成。
- `ProfilePage`：我的页面未正式设计。

当前写赛评入口约定：

- 左侧导航“写赛评”进入 `ReviewsPage` 列表。
- `ReviewsPage` 的标题 / 编辑按钮进入 `/reviews/:reviewId/edit`。
- `ReviewsPage` 的训练按钮暂时进入 `/trainings/new?reviewId=:reviewId`，作为后续训练关联的预留口。
- 从比赛卡片进入 `/reviews/match/:matchId/edit`，一场比赛只对应一篇赛评。
- 重要性颜色在赛评列表外侧圆点编辑，左侧栏自定义重点负责筛选。

## 设计系统状态

已有方向：

- 固定 app shell。
- 手绘外框。
- 小面积 hachure 选中填充。
- 收藏书签效果非常满意，应保留。
- `HandDrawnSelectionFill` / `HandDrawnAnimatedFill` 已作为手绘填充入口。
- `roughjs` 只应保留在 `src/design-system/handdrawn` 内部。

仍需整理：

- `globals.css` 仍有遗留样式。
- 部分页面和 feature 仍可能直接写视觉细节。
- 导航 active、按钮 active、标签 active 的入口还需要继续统一。

写赛评已收口的文件边界：

- `src/features/reviews/components/ReviewListRow.jsx`：赛评列表单行。
- `src/features/reviews/components/ReviewPriorityPicker.jsx`：赛评重要性颜色选择器。
- `src/features/reviews/components/ReviewsList.css`：赛评列表局部样式。
- `src/features/reviews/reviewListUtils.js`：赛评列表数据拼装、搜索和筛选。
- `src/pages/ReviewsPage.jsx`：赛评列表页面组合与页面级状态。
- `src/pages/ReviewEditorPage.jsx`：赛评编辑主流程。

## 下一步建议

优先级最高：

1. 做一次前端结构检查，确认哪些页面仍有 demo 遗留。
2. 不动爬虫数据，先稳定写赛评和做训练的页面边界。
3. 将页面层逻辑和可复用 UI 继续收口。

不建议立刻做：

- 新一轮爬虫。
- 真实后端。
- 云登录。
- AI 功能。
- 大规模重写视觉。
- 大规模拆 `globals.css`。
