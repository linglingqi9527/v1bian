# 视觉系统

「辩了么」的视觉方向是明亮手绘风。它应像一个被认真整理过的辩论工作台，有纸张感、铅笔感和手绘线条，但不能变成随意涂鸦。

## 视觉关键词

- 明亮
- 手绘
- 粗线条
- 不规则边框
- 纸张感
- 铅笔 / 手写质感
- 蜡笔 / 马克笔选中填充
- 结构清楚
- 信息层级明确

字体和颜色不要呈现纯黑机械感。线条可以有轻微不规则，但整体轮廓仍要方正、稳定、好读。

## 不要的方向

- 不要企业后台风。
- 不要科技黑。
- 不要赛博朋克。
- 不要低多边形运营插画。
- 不要把页面做成营销落地页。
- 不要使用大量无意义渐变、装饰色块或悬浮卡片。

## Design System 职责

`src/design-system` 是全站公共视觉组件库，不只是组件存放目录。后续页面不应在各自文件里重复实现边框、active 填充、卡片结构和按钮状态。

当前重点入口：

- `SketchButton`：全站按钮入口。
- `SketchTag`：全站状态标签入口。
- `SketchCard`：全站卡片入口。
- `HandDrawnSelectionFill`：当前 hachure 选中填充入口，负责按钮、标签、导航、收藏等选中态。
- `HandDrawnAnimatedFill`：较早的手绘填充动画入口，仍在部分组件中使用。
- `HandDrawnAppFrame`：应用外框手绘边界入口。
- `AppShell`、`SideNav`、`MobileNav`：应用壳和导航入口。

## 手绘选中态

选中态应该像“蜡笔 / 马克笔轻轻涂了一层”，而不是普通块状背景或密集表格底纹。

原则：

- 由 `HandDrawnSelectionFill` / `HandDrawnAnimatedFill` 统一实现，页面不直接操作 roughjs。
- 填充层在文字和图标下方，不能遮挡内容。
- 填充层 `pointer-events: none`。
- 填充区域应留出 inset，不贴满按钮边框。
- 动画只在切换选中时轻轻出现，不循环播放。
- 页面不直接操作 roughjs、SVG、动画细节。

## 手绘边框

边框样式必须集中管理。

原则：

- 页面不要各自写一套边框。
- 大外框、卡片框、按钮框、标签框应有层级粗细关系。
- 越外层边框越重，越内层边框略轻。
- 线条可以轻微变化，但不能穿模、遮挡文字或影响布局。
- 手绘 SVG 或装饰层必须限制在自己的组件容器内。

## roughjs 边界

`roughjs` 只能封装在 `src/design-system/handdrawn` 内部。

当前约定：

- `HandDrawnSelectionFill` 和 `HandDrawnAnimatedFill` 是 roughjs 选中填充的统一入口。
- 不要在页面、features 或 styles 中直接 import `roughjs`。
- 不要恢复基于 DOM 扫描的 `RoughSelectionLayer` 主方案。

## 素材管理

插图、图标、logo、纹理统一集中在 `src/assets`。

目录职责：

- `src/assets/illustrations`：共享插图，例如右上角主插画。
- `src/assets/icons`：导航和卡片操作图标。
- `src/assets/logo`：产品 logo。
- `src/assets/textures`：纸张、纹理等静态素材。
- `src/assets/handdrawn-shapes`：可复用手绘形状素材。

用户生成内容不能放入 `src/assets`。

## 当前待整理点

- `globals.css` 仍包含较多页面和组件样式，后续需要逐步拆分或收口。
- 部分页面 demo 结构仍保留局部样式类，后续应继续迁移到 `SketchButton`、`SketchTag`、`SketchCard`。
- `features/*/components` 仍可继续补充业务组件，但不应重复 design-system 的视觉职责。
