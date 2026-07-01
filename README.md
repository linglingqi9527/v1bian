# 辩了么 v1bian

「辩了么」是一个面向辩手的辩论复盘与训练工作台。它不是后台管理系统，也不是长网页，而是一个固定 app shell 里的工具型 Web App。

核心闭环：

```text
看比赛 -> 写赛评 -> 做训练
```

更完整的产品流程：

```text
看比赛 -> 标记已看 / 写赛评 -> 进入赛评 -> 从赛评开始训练 -> 录音或录像 -> 预览 -> 重录或保存 -> 生成训练记录 -> 回到赛评页查看关联训练
```

## 当前阶段

当前项目已经从早期 demo 进入“框架和流程收口”阶段。

已经有基础成果：

- 固定 app shell 方向已经建立。
- 看比赛页视觉和交互已经相对成熟。
- 比赛卡片支持搜索、筛选、收藏、已看、外部 B 站跳转。
- 已接入生成后的比赛数据 `src/data/generated/generatedMatches.json`。
- 当前生成比赛卡片约 379 条，其中一批比赛已有辩手与正反方分组数据。
- 爬虫和语音识别数据管线已完成一轮阶段性整理，当前暂时暂停。

当前重点：

- 回到前端框架和页面结构收口。
- 稳定 `design-system`，集中边框、动画、颜色、按钮、标签、卡片和素材入口。
- 继续整理写赛评和做训练流程。
- 保持看比赛页已有视觉和交互，不要轻易重做。

当前暂不做：

- 后端。
- 云登录。
- 产品内 AI 功能。
- React 页面实时请求 B 站。
- 扩展爬虫和语音识别流程，除非明确进入数据阶段。

## 核心对象

核心对象是比赛。

- 一个比赛对应一个赛评。
- 一个比赛可以对应多个训练。
- 赛评用于评价比赛。
- 训练备注用于评价自己的训练表现。
- 收藏、已看、赛评、训练都应预留 `userId`。

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

数据生成与爬虫脚本位于：

```text
scripts/crawler/bilibili
src/data/generated
```

这些数据管线是开发期工具，不应进入前端运行时请求流程。

## 开发命令

```bash
npm install
npm run dev
npm.cmd run build
npm.cmd run lint
```

Windows PowerShell 可能拦截 `npm.ps1`，此时使用 `npm.cmd`。

## 项目记忆系统

建议阅读顺序：

- [AI 开发规则](AGENTS.md)
- [当前状态](docs/CURRENT_STATUS.md)
- [新对话交接说明](docs/NEXT_HANDOFF.md)
- [产品需求](docs/PRODUCT_REQUIREMENTS.md)
- [应用结构](docs/APP_STRUCTURE.md)
- [视觉系统](docs/DESIGN_SYSTEM.md)
- [数据与保存方案](docs/DATA_AND_STORAGE.md)
- [开发记录](docs/DEVELOPMENT_LOG.md)

其中 `CURRENT_STATUS.md` 和 `NEXT_HANDOFF.md` 最接近当前真实状态；其他文档主要记录长期原则。
