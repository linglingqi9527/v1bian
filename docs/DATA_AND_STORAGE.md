# 数据与保存方案

当前 V1 阶段以本地生成数据、mock 用户数据和前端状态为主，不接后端、不接云登录、不保存真实用户媒体文件到源码目录。

## 当前数据层

当前基础数据入口放在：

- `src/data/demoMatches.js`
- `src/data/generated/generatedMatches.json`
- `src/data/demoReviews.js`
- `src/data/demoTrainings.js`
- `src/data/seedData.js`

`demoMatches.js` 会优先读取 `generatedMatches.json`；如果生成数据不可用，再回退到早期 demo 比赛。

业务服务放在：

- `src/features/matches/matchService.js`
- `src/features/reviews/reviewService.js`
- `src/features/trainings/trainingService.js`
- `src/features/storage/localDb.js`

数据模型放在：

- `src/models/matchModel.js`
- `src/models/reviewModel.js`
- `src/models/trainingModel.js`
- `src/models/userModel.js`

## 核心数据对象

### 比赛

后续比赛数据库需要支持：

- 比赛 ID
- 辩题
- 学校 / 队伍
- 辩手
- 比赛日期
- 赛事阶段
- BV 号
- B 站链接
- 封面或来源信息
- 用户是否已看
- 用户是否收藏

视频简介、语音转写和人工整理名单都可能提供辩手姓名。当前比赛数据已支持：

- `speakers`：平铺辩手名单。
- `speakerGroups`：按正反方和学校分组的辩手名单。
- `raw.speakerEnrichment`：辩手识别来源和更新时间。

### 赛评

赛评围绕某一场比赛建立。

规则：

- 一个比赛对应一个赛评。
- 赛评需要 `matchId`。
- 赛评需要 `userId`。
- 当前统一使用 `demo-user`。
- 赛评正文评价比赛，不保存训练备注。

### 训练

训练围绕某一场比赛或某一篇赛评建立。

规则：

- 一个比赛可以对应多个训练。
- 训练需要 `matchId`。
- 如果从赛评进入训练，应记录 `reviewId`。
- 训练需要 `userId`。
- 训练备注评价自己的表达，不写入赛评正文。

## 本地保存

V1 可以先使用 IndexedDB 保存用户赛评、训练、录音和录像的元数据。

建议顺序：

1. 先稳定 mock 数据结构。
2. 再接入 IndexedDB 保存赛评和训练文本。
3. 再考虑录音、录像文件的本地保存策略。
4. 最后再考虑本地文件夹导出、云同步和登录系统。

## 导入导出

后续可在 `features/storage` 中继续完善：

- `fileExportService.js`
- `fileImportService.js`
- `storageTypes.js`
- `localDb.js`

比赛数据导入和 B 站爬虫脚本目前主要位于 `scripts/crawler/bilibili`，前端规范化入口保留在 `features/crawler`。爬虫是开发期 Node 脚本，不应写进 React 页面，也不应在用户打开网页时实时运行。

当前爬虫阶段已经暂时告一段落。后续除非明确进入数据阶段，否则不要继续扩展爬虫、语音识别或修改 `generatedMatches.json`。

## assets 边界

`src/assets` 只放产品静态素材。

不要放入：

- 用户赛评正文
- 用户训练备注
- 用户录音文件
- 用户录像文件
- 用户导入的私人资料
- 运行时数据库文件

未来真实用户数据应进入 IndexedDB、本地文件夹、云存储或后端数据库，而不是进入源码素材目录。
