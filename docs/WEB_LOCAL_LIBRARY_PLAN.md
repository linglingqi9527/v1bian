# 网页端本地资料包模式方案

本文件记录「辩了么」后续的 B 方案：保持 React + Vite 网页应用不变，让用户在浏览器里主动选择一个本地文件夹作为「辩了么资料包」。用户的收藏、已看、赛评、训练记录、录音、录像等动态数据，未来都保存到这个资料包中。

本文件只做方案设计，不代表当前已经实装。

## 一、这不是桌面版

1. 本方案不是 Electron。
2. 本方案不是 Tauri。
3. 本方案不是桌面安装包。
4. 本方案仍然是浏览器网页应用。
5. 它只是让网页通过 File System Access API 访问用户主动选择的本地文件夹。
6. 第一阶段主要面向 Chrome / Edge 等支持 `showDirectoryPicker` 的浏览器。
7. 如果浏览器不支持 `showDirectoryPicker`，需要提示用户：

   > 当前浏览器暂不支持本地资料包模式，请使用 Chrome 或 Edge。

## 二、当前阶段目标

当前阶段只做方案设计，目标是：

1. 设计「辩了么资料包」应该长什么样。
2. 设计网页如何连接这个资料包。
3. 设计后续如何把用户数据逐步迁移到资料包。
4. 提醒后续开发要保持“系统包 / 用户资料包分离”。
5. 不要现在就大规模重构 `matchService`、`reviewService`、`trainingService`。
6. 不要现在就迁移所有 `localDb` 数据。
7. 不要破坏现有网页端运行。

当前最重要的目标不是“做账号”，而是框住数据边界：所有用户让页面发生变化的个体化变量，都必须进入用户资料包；去掉这些个体化变量后，网页应回到系统包提供的纯净默认状态。

## 三、系统包和用户资料包的关系

### 系统包

系统包是 App 本体，包括：

- React / Vite 代码
- 页面组件
- `design-system`
- 基础比赛数据 `generatedMatches.json`
- 默认素材
- 默认配置

系统包可以持续更新。系统更新只应该更新代码、默认样式、默认比赛库和默认素材。

### 用户资料包

用户资料包是用户本地选择的文件夹，包括：

- 收藏了哪些比赛
- 看过哪些比赛
- 哪些比赛写了赛评
- 赛评正文
- 哪些比赛做了训练
- 训练备注
- 录音文件
- 录像文件
- 用户设置

用户资料包不能被系统更新覆盖。

### 合并显示原则

`generatedMatches.json` 只作为基础比赛库读取。页面显示时，应该将基础比赛数据和用户资料包状态合并：

```txt
基础比赛库 generatedMatches.json
  + 用户资料包 matchStates / reviews / trainings / settings
  = 页面看到的“已看、收藏、已评、已练、重点、赛评、训练”等状态
```

例如：

- 系统包里的某场比赛默认没有收藏。
- 用户点击收藏后，只在资料包中写入 `matchStates[matchId].favorite = true`。
- 用户退出资料包或切换新资料包后，系统代码本身不变，收藏状态随资料包变化。

### 禁止写入的位置

1. 用户动态数据不要写进 `src`。
2. 用户动态数据不要写进 `public`。
3. 用户动态数据不要写进 `generatedMatches.json`。
4. 用户音频、视频不要写进 `src/assets` 或 `public`。
5. 后续 App 更新时，只更新系统包，不覆盖用户资料包。

## 四、第一版资料包目录结构

第一版资料包采用“总索引 + 三大功能文件夹”的结构。`bianleme-db.json` 负责给网页做精准关系索引；中文文件夹负责让用户在本地也能直观看懂自己的资料。

```txt
辩了么资料包/
├── bianleme-db.json
├── 01-看比赛/
├── 02-写赛评/
├── 03-做训练/
└── backups/
```

说明：

- `bianleme-db.json`：保存收藏、已看、赛评、训练元数据、关联关系、设置等用户数据。
- `01-看比赛/`：后续可保存比赛状态拆分文件；当前阶段先由 `bianleme-db.json.matchStates` 记录。
- `02-写赛评/`：后续每篇赛评可以有独立文件夹，正文保存为 Markdown。
- `03-做训练/`：每次训练一个独立文件夹，保存音频、视频、批注和训练元信息。
- `backups/`：保存升级前备份、手动备份、自动备份。

当前训练文件夹结构：

```txt
03-做训练/
└── training-xxxx-训练标题简写/
    ├── audio/
    ├── video/
    ├── 批注.md
    └── meta.json
```

其中：

- `audio/`：保存这次训练产生或导入的录音。
- `video/`：保存这次训练产生或导入的录像。
- `批注.md`：保存这次训练的文字批注，便于网页不可用时直接阅读。
- `meta.json`：保存这次训练的局部元数据，便于人工理解和后续恢复。

文件夹命名采用 `trainingId + 标题简写`。`trainingId` 是程序精确关联的依据；标题简写只给用户阅读，不作为唯一索引。

## 五、`bianleme-db.json` 第一版结构

第一版结构以稳定、简单、可迁移为目标。

```json
{
  "meta": {
    "libraryId": "library-xxxx",
    "schemaVersion": 1,
    "createdAt": "2026-07-01T00:00:00.000Z",
    "updatedAt": "2026-07-01T00:00:00.000Z",
    "appVersionLastOpened": "0.0.0"
  },
  "activeUserId": "demo-user",
  "users": [],
  "matchStates": {},
  "reviews": [],
  "trainings": [],
  "settings": {}
}
```

### `meta`

```json
{
  "libraryId": "library-xxxx",
  "schemaVersion": 1,
  "createdAt": "...",
  "updatedAt": "...",
  "appVersionLastOpened": "..."
}
```

- `libraryId`：资料包唯一 ID。
- `schemaVersion`：资料包结构版本，用于后续迁移。
- `createdAt`：资料包创建时间。
- `updatedAt`：资料包最后写入时间。
- `appVersionLastOpened`：最后打开该资料包的 App 版本。

### `activeUserId`

第一阶段可以继续使用 `demo-user`。后续如果做本地多用户，可以改成当前选中的本地用户 ID。

### `users`

第一版先预留，不急着做复杂账号系统。

```json
[
  {
    "id": "demo-user",
    "displayName": "演示用户",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

如果后续做本地密码，不要明文保存密码。应使用 `passwordSalt` 和 `passwordHash`，必要时再做资料包加密。

### `matchStates`

`matchStates` 负责保存比赛页面状态，以及由赛评、训练带来的关联状态。

```json
{
  "match-001": {
    "watched": true,
    "favorite": true,
    "reviewId": "review-001",
    "trainingIds": ["training-001"],
    "updatedAt": "2026-07-01T00:00:00.000Z"
  }
}
```

字段说明：

- `watched`：用户是否已看。
- `favorite`：用户是否收藏。
- `reviewId`：该比赛对应的赛评 ID。一个比赛只对应一篇赛评。
- `trainingIds`：该比赛关联的训练 ID 列表。一个比赛可以对应多次训练。
- `updatedAt`：该比赛用户状态最后更新时间。

后续可扩展：

- `lastOpenedAt`：用户最后打开该比赛链接的时间。
- `watchProgress`：如果未来做观看进度，可保存进度。
- `userNote`：如果未来做比赛级短备注，可放这里。

### `reviews`

`reviews` 负责保存赛评。赛评评价比赛，不评价自己。

```json
[
  {
    "id": "review-001",
    "userId": "demo-user",
    "matchId": "match-001",
    "title": "赛评标题",
    "contentHtml": "",
    "status": "draft",
    "priority": "yellow",
    "matchSnapshot": {
      "event": "2026新国辩",
      "teams": "A大学 vs B大学",
      "topic": "辩题",
      "year": "2026"
    },
    "manualSavedAt": "",
    "createdAt": "2026-07-01T00:00:00.000Z",
    "updatedAt": "2026-07-01T00:00:00.000Z"
  }
]
```

字段说明：

- `id`：赛评 ID。
- `userId`：所属用户。
- `matchId`：关联比赛 ID。私人赛评可以为空。
- `title`：赛评标题。
- `contentHtml`：编辑器正文 HTML。
- `status`：`draft` 或 `completed`。
- `priority`：重点颜色，第一版使用 `red`、`black`、`purple`、`yellow`。
- `matchSnapshot`：赛评创建时保存的比赛快照，用于基础比赛库变化时仍能显示上下文。
- `manualSavedAt`：用户最后一次手动保存时间。
- `createdAt` / `updatedAt`：创建和更新时间。

注意：当前代码里模型字段叫 `content`，文档第一版建议资料包字段使用 `contentHtml`，后续迁移时可在 `storageAdapter` 做兼容映射。

### `trainings`

`trainings` 负责保存训练记录。训练备注评价自己，不和赛评正文混在一起。

```json
[
  {
    "id": "training-001",
    "userId": "demo-user",
    "matchId": "match-001",
    "reviewId": "review-001",
    "title": "第一次训练",
    "note": "",
    "priority": "yellow",
    "folderPath": "03-做训练/training-001-第一次训练",
    "notePath": "03-做训练/training-001-第一次训练/批注.md",
    "metaPath": "03-做训练/training-001-第一次训练/meta.json",
    "mediaType": "audio",
    "mediaPath": "03-做训练/training-001-第一次训练/audio/录音-001.webm",
    "mediaItems": [
      {
        "id": "training-001",
        "type": "audio",
        "mimeType": "audio/webm",
        "path": "03-做训练/training-001-第一次训练/audio/录音-001.webm",
        "durationMs": 120000
      }
    ],
    "durationMs": 120000,
    "createdAt": "2026-07-01T00:00:00.000Z",
    "updatedAt": "2026-07-01T00:00:00.000Z"
  }
]
```

字段说明：

- `id`：训练 ID。
- `userId`：所属用户。
- `matchId`：关联比赛 ID。
- `reviewId`：关联赛评 ID，可以为空。
- `title`：训练标题。
- `note`：训练批注或训练备注。
- `priority`：重点颜色，第一版使用 `red`、`black`、`purple`、`yellow`。
- `folderPath`：该训练文件夹在资料包内的相对路径。
- `notePath`：训练批注 Markdown 文件路径。
- `metaPath`：训练局部元数据文件路径。
- `mediaType`：`audio` 或 `video`。
- `mediaPath`：音频或视频文件在资料包内的相对路径。
- `mediaItems`：该训练下的媒体列表。同一个训练编辑页内连续录音、录像或导入素材时，都追加到同一条训练记录的 `mediaItems`，不要在外部训练列表拆成多条训练。
- `durationMs`：训练素材时长。
- `createdAt` / `updatedAt`：创建和更新时间。

注意：`mediaPath` 必须是相对路径，不要写 `D:/...`、`F:/...`、`C:\\...` 这类绝对路径。

### `settings`

`settings` 保存用户个体化设置。

```json
{
  "theme": "default",
  "lastOpenedPage": "/matches",
  "lastActiveReviewFilter": "全部",
  "lastActiveTrainingFilter": "全部",
  "updatedAt": "2026-07-01T00:00:00.000Z"
}
```

第一版可以只保留空对象 `{}`。后续如果页面状态需要跨会话保留，再逐步登记。

## 六、用户个体化变量清单

本节是资料包模式最重要的边界。原则是：

> 任何由用户操作导致页面状态发生变化，并且希望下次打开仍然保留的变量，都属于用户资料包，不属于系统包。

### 比赛页面变量

这些变量来自看比赛页面或比赛卡片：

- `watched`：是否已看。
- `favorite`：是否收藏。
- `reviewId`：该比赛对应的赛评。
- `trainingIds`：该比赛对应的训练。
- `updatedAt`：该比赛状态最后变化时间。

这些变量不应该写回 `generatedMatches.json`。页面应读取基础比赛，再合并 `matchStates[matchId]`。

### 赛评变量

这些变量来自观赛日志、赛评编辑页和赛评列表：

- `id`
- `userId`
- `matchId`
- `title`
- `contentHtml`
- `status`
- `priority`
- `matchSnapshot`
- `manualSavedAt`
- `createdAt`
- `updatedAt`

其中 `priority` 同时影响：

- 赛评列表左侧颜色圆点
- 侧边栏自定义重点统计
- 赛评筛选结果

因此它必须是资料包里的稳定字段，而不是 UI 临时状态。

### 训练变量

这些变量来自练习室、训练编辑页和训练列表：

- `id`
- `userId`
- `matchId`
- `reviewId`
- `title`
- `note`
- `priority`
- `folderPath`
- `notePath`
- `metaPath`
- `mediaType`
- `mediaPath`
- `mediaItems`
- `durationMs`
- `createdAt`
- `updatedAt`

其中 `priority` 同时影响：

- 训练列表左侧颜色圆点
- 侧边栏自定义重点统计
- 训练筛选结果

### 媒体变量

音频和视频不能只作为临时 Blob 存在。进入训练记录后，需要写入资料包文件夹。

需要保存：

- 文件类型：`audio` 或 `video`
- MIME 类型：例如 `audio/webm`
- 相对路径：例如 `03-做训练/training-001-第一次训练/audio/录音-001.webm`
- 时长：`durationMs`
- 文件大小：后续可选
- 创建时间和更新时间

第一版把媒体文件信息放在 `trainings.mediaItems` 里。一条训练可以包含多个素材：

```json
{
  "mediaItems": [
    {
      "id": "training-001-media-001",
      "type": "audio",
      "path": "03-做训练/training-001-第一次训练/audio/录音-001.webm",
      "durationMs": 120000
    }
  ]
}
```

### 用户设置变量

后续可能需要保存：

- 当前资料包 ID
- 当前用户 ID
- 最近打开页面
- 最近使用的筛选条件
- 编辑器偏好
- 是否显示某些提示
- 备份提醒设置

这些都属于 `settings`，不要散落成新的 localStorage key。

### 新增变量登记规则

后续新增功能时，必须先判断：

1. 这个变量是不是由用户操作产生？
2. 这个变量下次打开是否需要保留？
3. 这个变量是否会影响页面显示、筛选、统计或关联关系？
4. 这个变量应该属于 `matchStates`、`reviews`、`trainings`、`settings`，还是需要新增集合？

只有回答清楚后，才能写入资料包结构。不要为了某个页面临时新增混乱字段。

## 七、后续需要预留的模块

本次只做设计，不实装或只做最小原型。

### `localLibraryService`

未来负责：

- 检测 `showDirectoryPicker` 是否可用。
- 用户选择资料包文件夹。
- 保存 `directoryHandle`。
- 重新连接资料包。
- 初始化 `bianleme-db.json`。
- 初始化 `01-看比赛`、`02-写赛评`、`03-做训练`、`backups`。
- 读取 `bianleme-db.json`。
- 写入 `bianleme-db.json`。
- 写入训练音频 / 视频文件。
- 写入训练 `批注.md` 和 `meta.json`。

`localLibraryService` 是唯一应该接触 File System Access API 的业务基础服务。页面层不直接调用 `showDirectoryPicker`。

### `libraryMigrationService`

未来负责：

- 检查 `schemaVersion`。
- 旧资料包升级。
- 升级前自动备份。
- 兼容旧版本资料包。
- 拒绝打开未来版本资料包，或提示升级 App。

升级前应将旧 `bianleme-db.json` 复制到 `backups/`。

### `storageAdapter`

未来负责：

- 当前没有连接资料包时，继续使用现有 `localDb`。
- 连接资料包后，优先读写本地资料包。
- 页面层仍然调用 `matchService`、`reviewService`、`trainingService`。
- 页面层不要直接读写本地文件。

理想方向：

```txt
MatchesPage / ReviewsPage / TrainingsPage
  -> matchService / reviewService / trainingService
  -> storageAdapter
  -> localDb 或 本地资料包
```

这样迁移期间页面可以保持稳定。

## 八、后续开发顺序

阶段 1：生成 `WEB_LOCAL_LIBRARY_PLAN.md` 方案文档。

阶段 2：做最小资料包连接入口。

阶段 3：能选择本地文件夹并初始化 `bianleme-db.json`。

阶段 4：能读取资料包 `meta` 并显示当前资料包状态。

阶段 5：收藏 / 已看写入资料包。

阶段 6：赛评写入资料包。

阶段 7：训练元数据写入资料包。

阶段 8：录音 / 录像写入 `03-做训练/training-xxxx-标题/audio|video`。

阶段 9：`schemaVersion` 和旧资料包迁移。

阶段 10：导入 / 导出 / 备份增强。

## 九、后续开发边界

1. 不要现在做 Electron。
2. 不要现在做 Tauri。
3. 不要现在做桌面安装包。
4. 不要把本地资料包逻辑写死到页面层。
5. 不要让 `MatchesPage`、`ReviewsPage`、`TrainingsPage` 直接操作文件系统。
6. 不要修改 `generatedMatches.json` 保存用户状态。
7. 不要把用户音视频写进 `src/assets` 或 `public`。
8. 后续 App 更新时，只更新系统包，不覆盖用户资料包。
9. 后续新版本需要通过 `schemaVersion` 识别旧资料包。
10. 不要现在大规模迁移所有 `localDb` 数据。
11. 不要为了资料包模式重写所有页面。
12. 不要在 React 页面里实时请求 B 站或修改爬虫数据管线。

## 十、第一阶段打开资料包时的用户体验

第一阶段可以提供一个简单入口：

1. 用户点击“选择辩了么资料包”。
2. 浏览器弹出文件夹选择器。
3. 用户选择一个文件夹。
4. App 检查该文件夹是否存在 `bianleme-db.json`。
5. 如果没有，则询问是否初始化为新资料包。
6. 初始化后创建目录和 JSON 文件。
7. 页面显示“已连接资料包”。

如果浏览器不支持：

> 当前浏览器暂不支持本地资料包模式，请使用 Chrome 或 Edge。

如果权限丢失：

> 需要重新连接辩了么资料包，请再次选择之前的文件夹。

## 十一、当前项目迁移注意事项

当前项目已经存在：

- `features/storage/localDb.js`：使用 `localStorage` 保存轻量本地数据库。
- `features/matches/matchService.js`：保存已看、收藏、`reviewId`、`trainingIds` 等比赛状态。
- `features/reviews/reviewService.js`：保存赛评。
- `features/trainings/trainingService.js`：保存训练元数据。
- `features/trainings/trainingMediaStore.js`：使用 IndexedDB 保存训练媒体 Blob。

后续不应直接推倒这些服务。建议先增加 `storageAdapter`，让这些 service 逐步改为通过 adapter 读写。

短期兼容策略：

```txt
未连接资料包：普通本地身份不读写个体变量
已连接资料包：普通本地身份优先使用 bianleme-db.json + 01-看比赛 / 02-写赛评 / 03-做训练
开发者入口：保留 localDb + IndexedDB 媒体缓存作为调试数据
```

这样可以保证旧功能不断，资料包模式逐步接管。

## 十二、当前最小原型状态

当前已开始实装阶段 2 到阶段 4 的最小原型，但还没有迁移业务数据。

已新增：

- `src/features/storage/localLibraryService.js`
- `src/features/storage/components/LocalLibraryPanel.jsx`
- `src/features/storage/components/LocalLibraryPanel.css`

当前能力：

1. 检测浏览器是否支持 `showDirectoryPicker`。
2. 在设置页展示“辩了么资料包”连接状态。
3. 用户点击“选择资料包”后，通过浏览器原生文件夹选择器选择本地文件夹。
4. 初始化第一版资料包目录：

   ```txt
   bianleme-db.json
   01-看比赛/
   02-写赛评/
   03-做训练/
   backups/
   ```

5. 如果 `bianleme-db.json` 不存在或为空，创建第一版空数据库。
6. 如果资料包已存在，读取其中的 `meta` 并显示资料包 ID、结构版本和文件夹名。
7. 使用 IndexedDB 保存用户选择过的 `directoryHandle`，后续可尝试重新连接。

当前明确没有做：

1. 没有把收藏、已看写入资料包。
2. 没有把赛评写入资料包。
3. 训练记录已开始做最小写入闭环，但还没有完整接管训练列表读取。
4. 没有替换 `matchService`、`reviewService`、`trainingService` 的全部数据来源。
5. 没有迁移已有 `localDb` 或 IndexedDB 媒体缓存。
6. 没有做 Electron、Tauri 或桌面安装包。

当前边界仍然是：

```txt
设置页 LocalLibraryPanel
  -> localLibraryService
  -> File System Access API / IndexedDB directoryHandle
```

页面层仍然不直接读写文件。后续业务页面应继续通过 service 和 `storageAdapter` 逐步接入资料包。

## 十三、当前本地身份、开发者入口与纯净状态

当前已新增一个最小本地登录层，用来区分三种状态：

1. 纯净未登录状态。
2. 普通用户的本地身份状态。
3. 开发者调试状态。

已新增：

- `src/features/auth/authService.js`
- `src/pages/ProfilePage.css`

当前规则：

1. 左下入口文案从“设置”改为“登录 / 已登录”。
2. 未登录时，页面仍然可以浏览基础比赛库。
3. 未登录时，不读取任何个人收藏、已看、赛评、训练和重点颜色。
4. 未登录时，比赛状态按纯净状态显示：
   - `watched: false`
   - `favorite: false`
   - `reviewId: null`
   - `trainingIds: []`
5. 未登录时，赛评列表为空。
6. 未登录时，训练列表为空。
7. 未登录时，保存赛评或训练会提示先登录本地身份。
8. 普通用户通过“本地身份登录”输入账号和密码。新账号会在当前浏览器创建；已有账号会校验密码后进入。
9. 普通用户的本地身份 ID 使用 `local:账号` 形式，避免和开发者调试数据混在一起。
10. 开发者入口是独立的小入口，用来进入 `demo-user` 调试数据。
11. `demo-user` 只用于开发者验证交互逻辑，不等于普通用户账号。
12. 密码只保存在当前浏览器本地，使用 salt + SHA-256 hash，不是云端账号。
13. 普通本地身份登录后，如果还没有连接本地资料包，仍然不能产生个体数据。
14. 未连接资料包时，收藏、已看、赛评、训练、重点颜色等操作都应被拦住，并提示先选择本地资料包。
15. 开发者入口不受资料包锁限制，因为它读取的是 `demo-user` 调试数据。

当前这一步仍然不是完整用户系统。它只是为了把“系统纯净态”“普通用户本地身份态”和“开发者调试态”分开，为后续资料包模式做准备。

当前数据边界：

```txt
未登录
  -> 只读基础比赛库
  -> 不读写任何个体变量

普通本地身份
  -> activeUserId = local:账号
  -> 必须先连接本地资料包
  -> 未连接资料包时不读写个体变量
  -> 当前阶段训练媒体和训练元数据已开始写入资料包
  -> 不再把普通用户训练记录写入浏览器 localDb 镜像
  -> 后续应通过 storageAdapter 完整统一资料包读写

开发者入口
  -> activeUserId = demo-user
  -> 继续读取当前浏览器里的 demo 调试数据
  -> 用于验证收藏、赛评、训练、重点标记等交互是否成立
```

资料包初始化边界：

1. 如果普通本地身份已经登录，初始化 `bianleme-db.json` 时可以写入当前 `local:账号`。
2. 如果未登录，初始化资料包时 `activeUserId` 为 `null`，`users` 为空数组。
3. 如果处于开发者调试状态，不应把 `demo-user` 当作普通资料包用户写入。

后续接入资料包后，目标会变成：

```txt
未登录
  -> 纯净基础比赛库

普通本地身份但未连接资料包
  -> 提示用户连接资料包
  -> 不允许写入收藏、赛评、训练、重点标记等个体变量

普通本地身份且连接资料包
  -> 优先读写辩了么资料包

开发者入口
  -> 保留 demo-user 调试数据
  -> 不作为普通用户资料包逻辑
```

注意：当前本地身份登录不等于资料包已经接管数据。资料包连接和身份登录目前仍是两个步骤，后续需要通过 `storageAdapter` 统一。

当前已加的最小锁定规则：

```txt
普通本地身份 + 未连接资料包
  -> listMatches 返回纯净比赛状态
  -> listReviews 返回空列表
  -> listTrainings 返回空列表
  -> save/update 操作被拦截

开发者入口 demo-user
  -> 继续允许读写浏览器里的 demo 调试数据
```

当前已完成：

```txt
普通本地身份 + 已连接资料包
  -> matchStates 的收藏 / 已看 / reviewId / trainingIds 写入资料包
  -> reviews 赛评写入资料包
  -> 当前页面会话内立即从资料包快照反向读取并更新页面
```

实现边界：

1. `matchService` 和 `reviewService` 仍是页面唯一的业务入口；页面不直接操作 File System Access API。
2. 普通用户每次保存先更新内存资料包快照，再按顺序写入 `bianleme-db.json`，避免连续收藏、已看、赛评保存互相覆盖。
3. 开发者入口继续只使用浏览器调试数据，不会写入普通用户资料包。
4. 完整的 storageAdapter 统一收口、资料包断开后的重连恢复提示和赛评 Markdown 镜像文件仍属于后续阶段；当前 `bianleme-db.json` 是赛评和比赛状态的唯一正式数据源。

## 十四、训练资料包写入最小闭环

当前已开始接入训练资料包写入，目标是先验证“网页可以把用户动态内容写到用户选择的本地文件夹里”。

当前已完成：

1. 训练页导入音频或视频时，普通本地身份会把媒体文件写入资料包：
   - 音频写入 `03-做训练/training-xxxx-标题/audio/`
   - 视频写入 `03-做训练/training-xxxx-标题/video/`
2. 训练页录音或录像后加入训练记录时，也会写入该训练自己的独立文件夹。
3. 训练元数据会写入 `bianleme-db.json` 的 `trainings` 数组。
4. 每次训练会同步写入：
   - `批注.md`
   - `meta.json`
5. `mediaPath` 使用相对路径，例如：

```json
"mediaPath": "03-做训练/training-xxxx-标题/video/录像-001.webm"
```

6. 训练标题、批注、模式、时长、关联比赛、关联赛评等基础字段会同步到训练元数据。
7. 开发者入口 `demo-user` 仍继续使用浏览器调试存储，不写入普通资料包。
8. 同一个训练编辑页内多次录音、录像或导入素材时，使用同一个 `trainingId`，所有素材追加到该训练的 `mediaItems`，外部训练列表只显示一条训练。
9. 普通本地身份连接资料包后，训练列表可以从当前资料包快照读取 `bianleme-db.json.trainings`，不再从浏览器 `localDb` 读取普通用户训练记录。

当前仍是最小闭环，不是最终数据层：

1. 资料包反向读取目前还是当前页面会话内的快照读取；刷新、权限丢失、重新连接后的完整恢复还需要继续做。
2. 开发者入口仍使用浏览器 localDb / IndexedDB 作为调试数据。
3. 删除训练时已尝试同步删除资料包元数据和媒体文件，但后续仍需要做更完整的异常处理。
4. 录音/录像最终文件格式和命名规范还可以继续收口。
5. 后续应把这些逻辑沉到 `storageAdapter`，避免训练 service 长期直接判断资料包模式。
