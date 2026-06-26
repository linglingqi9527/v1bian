# 2025 开场语音补辩手 Sample

该目录是独立试验管线，只读取 `generatedMatches.json`，不会修改正式 `speakers`，也不会接入 `crawl:xgb`。

## 流程

1. `selectSpeakerTargets.js`：从 2025 缺失报告中优先选择正式比赛和 CID 稳定的 10 条记录。
2. `extractOpeningAudio.js`：使用 `yt-dlp + ffmpeg` 仅截取开头 480 秒单声道 WAV。
3. `transcribeOpeningAudio.js`：使用 Whisper CLI 或 `faster-whisper` 转写，并缓存结构化 transcript。
4. `parseSpeakersFromTranscript.js`：识别正反方、辩位和姓名候选，标注置信度。
5. `buildSpeakerCandidateReport.js`：编排 sample 并输出候选、复核、仍缺失和汇总报告。

## 命令

```bash
npm run speakers:select:2025
npm run speakers:audio:sample:2025 -- --limit 10 --duration 480
```

已存在有效转写时会直接读取缓存；使用 `--force` 才会重新截取和转写。

## 2025 资格赛名单约束 Sample

名单库位于 `rosters/team_roster_2025_qualification.json`。该流程只截取双方自我介绍区间，寻找每个“一辩、二辩、三辩、四辩”标记后的姓名片段，再与两队报名名单执行拼音和近音全局匹配。最终只确认八名辩手分别属于哪支队伍，不依赖正反方和辩位结果：

```bash
npm run speakers:roster:sample:2025 -- --limit 5 --duration 480 --model small
```

名单约束转写使用独立缓存命名空间，不覆盖普通 sample，也不会写回正式比赛总表。

确认 sample 结果后，可批量处理所有名单覆盖的 2025 资格赛，并受控合并确定姓名：

```bash
npm run speakers:roster:2025 -- --duration 240 --model tiny
```

批量命令会补齐公开 CID、复用缓存，并只修改 `generatedMatches.json` 的 `speakers` 与审计信息。私人状态字段会在写入前后校验，无法确认或名单缺失的比赛保持不变。

默认只合并通过自动门槛的姓名。若人工确认当前低置信候选可接受，可显式加入：

```bash
npm run speakers:roster:2025 -- --duration 480 --model tiny --accept-low-confidence
```

该参数会把候选报告中的低置信姓名也同步到页面读取的 `generatedMatches.json`，并在 `raw.speakerEnrichment.acceptedLowConfidence` 中留下审计标记。

## 2024 资格赛名单整理

2024 资格赛名单有线上/线下赛段差异，但当前识别策略先按学校合并处理：同一学校不管线上还是线下，全部纳入同一个候选库，有匹配就进入候选。

- `rosters/team_roster_2024_qualification_combined_by_school.json`：同校合并版，当前识别的主依据。
- `rosters/team_roster_2024_qualification_by_stage.json`：按线上/线下赛段拆分，仅作为来源追溯和后续人工核对依据。

先只生成索引和覆盖报告，不直接写入卡片：

```bash
npm run speakers:roster:2024:report
```

输出：

- `src/data/generated/rosterIndex.2024.qualification.json`
- `src/data/generated/rosterDataReport.2024.qualification.json`

开始按学校合并名单做语音识别，仍然只输出候选报告，不写入卡片：

```bash
npm run speakers:roster:2024 -- --duration 480 --model tiny
```

输出：

- `src/data/generated/rosterSpeakerCandidates.2024.qualification.json`
- `src/data/generated/speakerIntroSnippets.2024.qualification.json`
- `src/data/generated/rosterSpeakerReport.2024.qualification.json`

## 本机依赖

Windows 示例：

```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
# 安装 Python 后二选一：
pip install -U openai-whisper
pip install -U faster-whisper
```

缺少依赖时命令仍会生成四份 sample 报告，并把安装提示写入 `warnings` 和失败原因统计。

## 缓存与输出

- 音频：`scripts/crawler/bilibili/.cache/audio/`
- 转写：`scripts/crawler/bilibili/.cache/transcripts/`
- 选样清单：`scripts/crawler/bilibili/.cache/speakerTargets.2025.sample.json`

缓存不提交 Git。正式输出位于 `src/data/generated/`，仅供人工复核，绝不自动合并。
