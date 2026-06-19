# 辩了么 v1bian

「辩了么」是一个面向辩手的辩论复盘与训练工作台。它不是后台管理系统，也不是长网页，而是一个固定 app shell 里的工具型 Web App。

## 项目定位

面向辩手的辩论复盘与训练工作台。

核心闭环：

看比赛 -> 写赛评 -> 做训练

更完整的产品流程：

看比赛 -> 标记已看 / 写赛评 -> 进入赛评 -> 从赛评开始训练 -> 录音或录像 -> 预览 -> 重录或保存 -> 生成训练记录 -> 回到赛评页查看关联训练。

## 核心对象

核心对象是比赛。

- 一个比赛对应一个赛评。
- 一个比赛可以对应多个训练。
- 赛评用于评价比赛。
- 训练备注用于评价自己的训练表现。

## 当前阶段

当前项目处于从 demo 过渡到正式项目结构的阶段。

当前重点：

- 整理 `design-system`。
- 集中管理手绘边框、选中填充动画、颜色、按钮、标签、卡片和素材入口。
- 保持 `roughjs` 只在 `src/design-system/handdrawn` 内部使用。
- 将页面中的重复视觉实现逐步迁移到 `SketchButton`、`SketchTag`、`SketchCard`。

当前暂不做：

- 后端
- 登录
- 真实 B 站数据
- 真实爬虫
- AI 功能

## 项目结构

```text
src
├── app
├── pages
├── features
├── design-system
├── assets
├── data
├── models
├── store
├── hooks
├── utils
├── styles
└── main.jsx
```

## 开发命令

```bash
npm install
npm run dev
npm run build
npm run lint
```

## 文档

- [产品需求](docs/PRODUCT_REQUIREMENTS.md)
- [应用结构](docs/APP_STRUCTURE.md)
- [视觉系统](docs/DESIGN_SYSTEM.md)
- [数据与保存方案](docs/DATA_AND_STORAGE.md)
- [开发记录](docs/DEVELOPMENT_LOG.md)
- [AI 开发规则](AGENTS.md)
