# 新国辩 B 站数据爬虫

这是开发期 Node 脚本，不会在 React 页面运行，也不会在用户打开网页时请求 B 站。

## 数据源

- 空间主页：<https://space.bilibili.com/257958427>
- 投稿页：<https://space.bilibili.com/257958427/upload/video>
- `mid`：`257958427`
- 完整索引：B 站公开合集/系列接口，优先覆盖分年赛事合集
- 投稿列表：B 站公开 WBI 空间投稿接口
- 备用索引：B 站公开视频搜索，并严格按目标 `mid` 过滤
- 视频详情：B 站公开 `x/web-interface/view` 接口

脚本只读取公开投稿和公开详情，不使用登录、Cookie、付费或私密数据，也不会尝试绕过 403、412、429 或 API 风控错误。

## 信息库分层

| 层级 | 文件 | 职责 |
| --- | --- | --- |
| 来源层 | `bilibiliApi.js` | 定义空间投稿、公开搜索、赛事合集和视频详情来源，并把各接口响应转为统一 video 记录。 |
| 来源层 | `videoSources.js` | 按 BV 合并合集、搜索和详情来源，优先保留更完整的标题、简介和分 P 信息。 |
| 来源层 | `matchVideoFilter.js` | 按年份和比赛特征过滤宣传片、短片等非比赛候选。 |
| 抓取层 | `httpTransport.js` | 提供带超时、重试友好错误和 User-Agent 的 `fetch` / `curl` JSON 请求。 |
| 抓取层 | `crawlXinGuoBian.js` | 编排查找、详情补全、合并、过滤、标准化、状态保留和报告输出。 |
| 缓存层 | `searchCache.js` | 读取公开视频搜索和详情缓存，忽略无效或风控响应。 |
| 缓存层 | `seasonArchiveCache.js` | 读取赛事合集分页缓存并转为统一 video 记录。 |
| 标准化层 | `expandMultipartVideos.js` | 将一个 BV 下的多 P 合集展开为独立比赛，并生成稳定 `BV-pN` 数据键。 |
| 标准化层 | `parseBilibiliDescription.js` | 从标题和简介解析赛事、赛段、辩题、队伍、辩手与警告。 |
| 标准化层 | `normalizeMatch.js` | 生成前端 match 结构，并在重跑时保留用户状态字段。 |
| 标准化层 | `crawlerReports.js` | 计算字段覆盖、辩手状态、重复项、过滤量和缺失明细。 |

`crawlXinGuoBian.js` 是唯一编排入口；React 页面不参与抓取或解析。各来源先统一成 video，再统一进入标准化层，因此新增来源时不需要改页面和 match 状态逻辑。

## 运行

```bash
npm run crawl:xgb
```

只补全当前生成数据中缺少简介的公开视频详情：

```bash
npm run crawl:xgb:details
```

可选环境变量：

| 变量 | 默认值 | 说明 |
| --- | ---: | --- |
| `BILIBILI_DELAY_MS` | `900` | 请求之间的等待时间 |
| `BILIBILI_PAGE_SIZE` | `30` | 每页投稿数，最大 50 |
| `BILIBILI_MAX_PAGES` | 不限制 | 调试时限制列表页数 |
| `BILIBILI_MAX_VIDEOS` | 不限制 | 调试时限制详情数量 |
| `BILIBILI_HTTP_TRANSPORT` | `fetch` | HTTP 传输；Node fetch 不通时可设为 `curl` |
| `BILIBILI_SEARCH_MAX_PAGES` | `50` | 每个年份的公开视频搜索最大页数 |
| `BILIBILI_YEARS` | `2023,2024,2025,2026` | 要导入的赛事年份 |
| `BILIBILI_SOURCE` | `auto` | `auto` 在线抓取并在失败时回退缓存；`cache` 只读取本地公开响应缓存 |
| `BILIBILI_INCLUDE_MIDDLE_SCHOOL` | `false` | 是否纳入中学组；当前产品数据范围默认排除中学组 |

PowerShell 调试示例：

```powershell
$env:BILIBILI_HTTP_TRANSPORT='curl'; $env:BILIBILI_MAX_VIDEOS='3'; npm run crawl:xgb
```

只从已取得的公开响应缓存重新生成数据：

```powershell
$env:BILIBILI_SOURCE='cache'; npm run crawl:xgb
```

## 输出

- `src/data/generated/rawBilibiliVideos.json`：列表和详情接口的原始公共字段。
- `src/data/generated/generatedMatches.json`：解析、标准化并按 `bvid` 去重后的比赛数据。
- `src/data/generated/crawlerDataReport.json`：当前信息库覆盖率、过滤量、重复项和解析警告统计。
- `src/data/generated/missingSpeakerReport.json`：`speakerStatus` 为 `missing` 或 `partial` 的比赛明细。

多 P 赛事合集会按分 P 展开为独立比赛，使用 `BV号-p序号` 作为稳定数据键，卡片链接会直接打开对应分 P。合集归档、投稿搜索和多 P 详情在爬虫层合并，React 页面只读取最终 JSON。

重新运行时，`generatedMatches.json` 中同一 `bvId` 的 `favorite`、`watched`、`reviewId`、`trainingIds` 会被保留。浏览器中的 localStorage 状态由前端 `matchService.js` 在加载时继续覆盖到基础数据上。

字段可靠性约定：BV、链接、标题和发布时间主要来自接口原始字段，可靠性高；赛事、赛段和队伍来自标题/简介解析，可靠性中等；辩手字段必须结合 `speakerStatus` 判断完整度。

如果列表请求失败、所有详情请求失败或遇到风控，脚本会以非零状态退出，并且不会覆盖已有 JSON。
