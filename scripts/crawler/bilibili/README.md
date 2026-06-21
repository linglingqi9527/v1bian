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

## 运行

```bash
npm run crawl:xgb
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

多 P 赛事合集会按分 P 展开为独立比赛，使用 `BV号-p序号` 作为稳定数据键，卡片链接会直接打开对应分 P。合集归档、投稿搜索和多 P 详情在爬虫层合并，React 页面只读取最终 JSON。

重新运行时，`generatedMatches.json` 中同一 `bvId` 的 `favorite`、`watched`、`reviewId`、`trainingIds` 会被保留。浏览器中的 localStorage 状态由前端 `matchService.js` 在加载时继续覆盖到基础数据上。

如果列表请求失败、所有详情请求失败或遇到风控，脚本会以非零状态退出，并且不会覆盖已有 JSON。
