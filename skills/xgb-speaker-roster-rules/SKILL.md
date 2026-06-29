---
name: xgb-speaker-roster-rules
description: Use when working on v1bian 新国辩资格赛辩手数据、巡礼名单、语音转写缓存、候补识别、speakerGroups、generatedMatches.json 正式卡片入库规则， especially when deciding whether roster candidates, transcript matches, completion candidates, or manual verifications may enter formal match card data.
---

# 新国辩辩手名单规则

## 核心原则

只把“有依据的辩手姓名”写入正式卡片数据。不要为了补满 8 人，把同校报名名单或候补池自动塞进 `generatedMatches.json`。

爬虫和语音识别模块必须和前端页面隔离。处理辩手数据时，不要修改 `MatchesPage.jsx`、视觉 CSS 或 design-system，除非用户明确要求调整页面展示。

## 数据层级

### 正式卡片数据

正式卡片数据是 `src/data/generated/generatedMatches.json` 中每场比赛的：

- `speakers`
- `speakerGroups`
- `raw.speakerEnrichment`

正式卡片以 `speakers` 展示一行辩手名；当存在 `speakerGroups` 时，`speakers` 必须由 `speakerGroups` 展平得到。

### 持方分组

使用 `speakerGroups` 表达持方：

```json
[
  { "side": "正方", "team": "A队", "speakers": ["一", "二", "三", "四"] },
  { "side": "反方", "team": "B队", "speakers": ["五", "六", "七", "八"] }
]
```

规则：

- 每个持方最多 4 人。
- 一场比赛最多 8 人。
- 正方在前，反方在后。
- 页面显示可以仍然是一行名字，不必在视觉上拆左右栏。
- 搜索文本应包含 `speakers` 和 `speakerGroups` 中的队伍及姓名。

## 候选类型

### 可入正式卡片

以下类型可以进入正式卡片：

- 转写文本中直接匹配到巡礼名单的人名。
- 在“一辩 / 二辩 / 三辩 / 四辩”附近窗口中匹配到的人名。
- 同一句或相邻片段中有持方、辩位、姓名线索的人名。
- 用户人工确认过的人名，记录为 manual verification。
- 低置信但已经被巡礼名单约束、且确实来自转写文本姓名窗口的人名，必须先进入候补报告；只有该批候补经人工抽样确认准确率高，才允许按得分入库。

### 不可自动入正式卡片

以下类型不能自动进入正式卡片：

- `tightRosterCompletion`
- `completionCandidates`
- 仅因为“同校报名名单里还有这些人”而补出来的人名。
- 仅为了把人数补到 6 或 8 的扩展候补。
- 没有转写片段支持、没有人工确认的人名。

这些只能留在 review/report 文件中，作为人工核查线索。

## 候补定义

候补不是把同校名单中“还没用上的人”丢进去。候补必须同时满足：

- 来自转写文本证据，例如自我介绍段、辩位关键词附近、队伍介绍附近或相邻句。
- 与巡礼名单姓名存在可计算的相似度。
- 有明确分数，至少包含 `score`、`evidenceType`、`rawText` 或 `transcriptSnippet`。
- 能说明为什么属于某个队伍或持方。

候补分数应综合：

- 辩位关键词距离：姓名越靠近“一辩 / 二辩 / 三辩 / 四辩”或“正方 / 反方辩手”窗口，权重越高。
- 文本相似度：中文字符、拼音、常见转写误差和近音误差都可以参与评分。
- 队伍约束：只在该场双方队伍的名单中选人。
- 片段位置：自我介绍段、双方介绍段优先于整段转写中的散落姓名。
- 冲突惩罚：同一持方已满 4 人、同名重复、或多个名单成员分数接近时降低自动入库信心。

候补数量必须按缺口限制：

- 每个持方最多 4 人。
- 如果某持方已确认 3 人，只能给 1 个候补，即该持方得分最高的候补。
- 如果某持方已确认 2 人，最多给 2 个候补。
- 不要为了展示“可能名单”而输出超过空缺数量的候补；多余低分项只能进入调试明细，不能进入候补主列表。

候补入库流程：

1. 高分直接匹配可以进入正式卡片。
2. 低分或模糊匹配进入候补名单。
3. 从候补名单抽取少量样本给人工检查准确度。
4. 如果该批候补准确率被用户确认较高，才允许该批候补按分数和缺口规则进入正式卡片。
5. 如果用户指出候补全错，该批候补必须保持只读报告状态，不能自动合并。

## 匹配排序

同一持方内按匹配可信度排序后取前 4 人。

优先级：

1. manual verification
2. 精确姓名匹配
3. 拼音完全匹配
4. 拼音模糊匹配
5. 角色窗口匹配，即“一辩/二辩/三辩/四辩”后出现的姓名窗口；该项应作为强加权因素
6. 队伍/持方提示加权匹配
7. 低置信但仍来自转写文本的名单约束匹配

不要让 completion candidates 参与正式排序，除非它们已经通过上面的“候补定义”和“候补入库流程”，或用户明确把某些名字人工确认为上场辩手。

## 候补报告

二次比对报告可以保留 expanded 指标，但必须解释为“待复核名单池”，不是识别成功：

- `expandedSpeakerCount`
- `completionCandidateCount`
- `expandedTeams[].completionCandidates`

报告中要明确：

- expanded 不是正式入库依据。
- tightRosterCompletion 不能自动合并进正式卡片。
- 如果用户说扩展候补准确率差，必须保持扩展候补只读，不要合并。

## 合并规则

合并进 `generatedMatches.json` 时：

- 保留 `watched`、`favorite`、`reviewId`、`trainingIds`。
- 不覆盖用户状态字段。
- 对目标年份和目标范围重新生成 `speakerGroups`，不要用旧 `speakers` 平铺并集残留。
- `speakers` 应由 `speakerGroups` 展平生成。
- 每个持方最多 4 人。
- 一场最多 8 人。
- 记录 `raw.speakerEnrichment.source`、`sourceYear`、`acceptedRules` 和 `updatedAt`。

默认合并规则只能接受转写文本直接匹配和人工确认。不要默认合并 `completionCandidates`。

如果脚本提供 `--include-completion-candidates`，它必须被视为危险/实验开关；常规流程不要使用。

## 年份策略

### 2024

2024 资格赛已支持 `speakerGroups`，正式卡片版应保持：

- 所有目标比赛有持方分组。
- 每个持方不超过 4 人。
- 扩展候补不应继续自动进入正式数据。

### 2025

2025 已有校准名单时，优先用缓存自我介绍文本重跑二次比对。

当前关键点：

- 2025 的扩展候补准确率已被用户判定不可直接信任。
- 2025 的 `completionCandidates` 只能做人工核查，不可自动写入正式卡片。
- 2025 若要进入正式卡片，应优先合并直接转写匹配到的人名，并逐步补 `speakerGroups`。

## 缓存规则

保留文字缓存，避免反复转写：

- `speakerIntroSnippets.*.qualification.json`
- transcript 文本缓存

音频缓存可以删除，尤其是批量处理后，避免占用过多空间。

不要把音频、转写缓存或用户数据放进 `src/assets`。

## 操作纪律

处理辩手名单时：

- 不要改前端视觉。
- 不要改 `MatchesPage.jsx` 的 DOM 主结构。
- 不要把爬虫请求写进 React 页面。
- 不要做全量音频转写，除非用户明确要求。
- 不要把候补池误报为识别成功。
- 修改后运行 `npm run build`。

## 常用判断

如果用户问“这个候补能不能进正式名单”：

1. 检查它是否来自转写文本直接匹配。
2. 检查是否有一辩/二辩/三辩/四辩附近窗口。
3. 检查是否被人工确认。
4. 检查它是否有分数，且是否是该持方空缺数量内的最高分候补。
5. 如果只是 `completionCandidates`，回答不能自动进入正式名单。

如果用户提供新校准名单：

1. 把名单作为 roster 输入。
2. 用现有 intro/transcript 缓存重跑二次比对。
3. 先生成报告，不直接合并正式卡片。
4. 汇报直接新增、低于 4/6 人、候补池规模。
5. 只有直接匹配或人工确认的人名才可进入正式卡片。
