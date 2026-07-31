# 辩了么匿名行为统计系统

## 目标与边界

这是一套与用户资料包分离的匿名行为统计系统。用户收藏、已看、赛评正文、训练批注、录音和录像仍保存在用户自己的本地资料包；统计系统只上传经过白名单清理后的行为事件，用来理解功能使用情况。

它不是用户内容同步系统，不读取 `bianleme-db.json`、不读取本地媒体文件，也不修改比赛基础库。

## 目录与职责

```text
src/features/analytics/
├── index.js                         # 页面唯一公共入口
├── analyticsService.js               # track、事件补全、发送和静默失败
├── analyticsEvents.js                # 事件目录、分类和字段许可
├── analyticsSchema.js                # schemaVersion 与标准事件对象
├── analyticsIdentity.js              # anonymousId、sessionId、未来 cloudUserId
├── analyticsSanitizer.js             # 白名单清理
├── analyticsConfig.js                # Vite 环境变量与统计开关
├── analyticsQueue.js                 # 最多 40 条、3 天过期的失败队列
├── providers/
│   ├── noopAnalyticsProvider.js      # 禁用、开发环境或缺配置时使用
│   └── cloudbaseAnalyticsProvider.js # sendBeacon / fetch 发送器
└── hooks/usePageViewTracking.js      # React Router 页面浏览统计

cloudbase/functions/logAnalyticsEvent/
├── index.js                          # CloudBase HTTP 云函数
└── package.json                      # 仅云函数运行时依赖
```

业务页面只能从 `src/features/analytics/index.js` 导入 `track`、`ANALYTICS_EVENTS` 和 `usePageViewTracking`，不能直接访问 provider、队列、CloudBase 或本地身份实现。

## 数据流程

```text
业务动作保存成功
→ 页面调用 track(ANALYTICS_EVENTS.xxx, properties)
→ analyticsService 补身份、session、路径、版本、时间和 eventId
→ analyticsSanitizer 按该事件白名单清理 properties
→ provider 发送；网络失败时进入轻量队列
→ CloudBase 云函数重新校验并用 eventId 去重
→ analytics_events 集合
```

统计任一步失败都被吞掉或进入小队列，绝不能影响收藏、赛评、训练、录音录像或资料包写入。

## 标准事件结构

```js
{
  schemaVersion: 1,
  eventId: 'event_xxx',
  eventName: 'review_saved',
  category: 'review',
  occurredAt: '2026-07-29T10:00:00.000Z',
  actor: {
    identityType: 'anonymous',
    anonymousId: 'anon_xxx',
    cloudUserId: null,
  },
  sessionId: 'session_xxx',
  app: { appVersion: '0.1.0', platform: 'web' },
  context: {
    path: '/reviews/review-001/edit',
    browserFamily: 'Chrome',
    operatingSystem: 'Windows',
    language: 'zh-CN',
  },
  properties: { reviewId: 'review-001', status: '草稿', contentLength: 800 },
}
```

`schemaVersion` 独立于 App 版本。将来改变字段结构时，云端根据 `schemaVersion` 保留旧记录兼容逻辑。

## 事件清单

| 分类 | 事件 |
| --- | --- |
| app | `app_open`、`app_error` |
| navigation | `page_view` |
| match | `match_favorite_changed`、`match_watched_changed` |
| review | `review_editor_opened`、`review_saved` |
| training | `training_editor_opened`、`recording_started`、`recording_stopped`、`training_saved` |
| local_library | `local_library_connected`、`local_library_connection_failed` |

每个事件的允许字段在 `analyticsEvents.js` 中集中定义。例如 `review_saved` 只允许 ID、状态、正文长度和来源；不会上传正文。

## 隐私与字段白名单

允许的 properties 仅包含：`matchId`、`reviewId`、`trainingId`、`favorite`、`watched`、`status`、`contentLength`、`contentLengthRange`、`mediaType`、`durationMs`、`connected`、`errorCode`、`errorType`、`source`、`success`。

永久禁止上传：赛评正文、HTML、训练批注、转写稿、Blob、音视频、媒体路径、本地文件夹和文件路径、密码、令牌、手机号、邮箱、真实姓名、用户名。前端开发环境会对被拒字段 `console.warn`，生产环境直接删除；云函数还会再次拒绝它们。

上传的浏览器信息仅为浏览器家族、操作系统类别和语言，不上传完整 User-Agent、IP、设备指纹或本地路径。

## 身份与用户数

首次真正启用统计时，浏览器生成并保存 `anonymousId`；一次标签页会话生成或恢复 `sessionId`。

- `anonymousId`：浏览器或本地环境级别的匿名标识，不是用户名，也不等于绝对真实人数。
- `sessionId`：一次浏览器会话的临时标识。
- `cloudUserId`：未来云端注册账号提供的不可读主键；当前仅预留 `setCloudIdentity(cloudUserId)`、`clearCloudIdentity()`、`getAnalyticsIdentity()`，尚未实装云端登录。

当前近似用户数按 `anonymousId` 去重，可计算匿名总用户、DAU/WAU/MAU、新增、回访和功能使用次数。同一人换浏览器、清除浏览器数据会得到新 ID；多人共用浏览器可能共用一个 ID。未来注册用户统计应优先按 `cloudUserId` 去重，未登录流量仍按 `anonymousId` 去重。不能用本地昵称、用户名或本地 userId 冒充 `cloudUserId`。

## 环境变量与开关

在部署环境配置，不提交真实 endpoint：

```env
VITE_APP_VERSION=0.1.0
VITE_ANALYTICS_ENABLED=true
VITE_ANALYTICS_PROVIDER=cloudbase
VITE_ANALYTICS_ENDPOINT=https://your-endpoint/logAnalyticsEvent
```

缺少 endpoint、用户关闭匿名统计、provider 不匹配或本地开发时，系统自动使用 noop provider，不产生网络请求。用户偏好只使用一个独立键 `bianleme.analytics.preference.v1`，当前尚未增加设置页开关；将来设置页调用 `setAnalyticsPreference(false)` 即可关闭。

## CloudBase 部署

1. 在 CloudBase 控制台创建 `analytics_events` 文档集合，客户端数据库规则设置为禁止直接写入。
2. 创建一个 Node.js HTTP 云函数 `logAnalyticsEvent`，上传 `cloudbase/functions/logAnalyticsEvent.zip`。压缩包根目录必须直接包含 `index.js`、`server.js`、`package.json` 和可执行的 `scf_bootstrap`，不能再套一层 `logAnalyticsEvent/` 文件夹。
3. `scf_bootstrap` 会以 Web 函数方式启动 `server.js`，监听 `0.0.0.0:9000`。这是 HTTP 云函数的运行要求；普通 `exports.main` 事件函数不能直接作为该类 HTTP 云函数上传。
4. 选择 Node.js 20.19 并开启自动安装依赖。函数会安装 `@cloudbase/node-sdk`，且可通过 `cloudbase.init({})` 使用当前环境上下文。
5. 若控制台仍提示启动文件权限问题，请在函数详情的代码编辑器中将 `scf_bootstrap` 的内容保持不变并保存；控制台会以可执行方式重新部署该启动文件。
6. 为 HTTP 云函数创建访问地址，并将地址写到部署环境的 `VITE_ANALYTICS_ENDPOINT`。
7. 确认 HTTP 函数允许 `POST` 和 `OPTIONS`，再在生产环境将 `VITE_ANALYTICS_ENABLED` 设为 `true`。

函数会校验 `schemaVersion`、事件名、分类、字段类型和长度，并再次清理敏感字段。它使用 `eventId` 作为文档 ID，重复重试不会生成第二条统计记录；服务器自己写入 `receivedAt`，不信任前端的接收时间。

CloudBase 相关部署与 SDK 参考：[云函数文档](https://cloud.tencent.com/document/product/876/46899)、[Node.js SDK 文档](https://cloud.tencent.com/document/product/876/47058)。

## 更换后端

网页业务页不依赖 CloudBase。更换平台时新增 provider，保持 `send(standardEvent)` 输入不变，再通过 `VITE_ANALYTICS_PROVIDER` 和 endpoint 选择它；现有事件、身份、清理器和页面埋点不需要修改。

## 测试与自查

- 未配置 endpoint 或本地开发时确认无网络请求、主功能正常。
- 生产配置后确认 `app_open`、一次路由切换和一次成功保存各只发送一个标准事件。
- 传入 `content`、`note`、`mediaPath`、`password` 等字段，确认前端不会发送，云函数也返回拒绝。
- 断网时确认最多缓存 40 条，超过 3 天的事件会清理；恢复网络后可重试。
- 赛评保存只含正文长度，不含正文；训练保存只含媒体类型和时长，不含媒体或路径。
- 调用 `setCloudIdentity` 后确认 actor 自动变为 `cloud`，页面埋点代码无需改变。
