import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { extractOpeningAudio } from './extractOpeningAudio.js'
import { matchRosterSpeakers } from './matchRosterSpeakers.js'
import {
  AUDIO_CACHE_DIR,
  GENERATED_DIR,
  parseCliOptions,
} from './selectSpeakerTargets.js'
import { loadTeamRoster, resolveTargetRoster } from './teamRoster.js'
import { transcribeOpeningAudio } from './transcribeOpeningAudio.js'
import { resolveTargetMedia } from './resolveTargetMedia.js'
import { createIntroSnippetRecord } from './transcriptIntroSnippet.js'

const YEAR = 2024
const COMPETITION_TYPE = '第十一届新国辩'
const SCOPE = 'janMain'
const CACHE_NAMESPACE = 'roster-2024-jan-main'
const MATCHES_PATH = path.join(GENERATED_DIR, 'generatedMatches.json')
const ROSTER_PATH = fileURLToPath(
  new URL('./rosters/team_roster_2024_jan_verified_v2.json', import.meta.url),
)

async function buildRoster2024JanMainReport(options = {}) {
  const startedAt = Date.now()
  const outputPaths = createOutputPaths()
  const limit = options.all ? Number.POSITIVE_INFINITY : options.limit ?? 5
  const [matches, rosterRows] = await Promise.all([
    readJson(MATCHES_PATH),
    loadTeamRoster({
      competitionType: COMPETITION_TYPE,
      rosterPath: ROSTER_PATH,
      year: YEAR,
    }),
  ])
  const existingIntroSnippetIds = options.missingIntroOnly
    ? await readNonEmptyIntroSnippetIds(outputPaths.introSnippets)
    : null
  const targets = selectJanMainTargets(matches)
  const rosterTargets = targets
    .filter((target) => !options.matchId || target.matchId === options.matchId)
    .map((target) => ({ target, roster: resolveTargetRoster(target, rosterRows) }))
  const skippedNoRoster = rosterTargets.filter((item) => !item.roster.covered)
  const eligible = rosterTargets
    .filter((item) => item.roster.covered && item.target.processable)
    .filter((item) => !existingIntroSnippetIds?.has(item.target.matchId))
  const selected = eligible.slice(0, limit)
  const records = []
  const introSnippets = []
  const commandLabel = `speakers:roster:${YEAR}:jan-main`

  for (const [index, item] of selected.entries()) {
    const { roster, target } = item
    console.log(`[${commandLabel}] ${index + 1}/${selected.length} ${target.matchId}`)
    let resolvedTarget
    try {
      resolvedTarget = await resolveTargetMedia(target)
    } catch (error) {
      resolvedTarget = {
        ...target,
        warnings: [...target.warnings, `获取视频 CID 失败：${error?.message ?? error}`],
      }
    }

    const windowResult = await transcribeAndMatchTarget({
      options,
      resolvedTarget,
      roster,
    })
    const { audio, matched, transcript } = windowResult
    introSnippets.push(createIntroSnippetRecord({
      matched,
      target: resolvedTarget,
      transcript,
    }))
    records.push(createRecord({
      audio,
      matched,
      resolvedTarget,
      roster,
      target,
      transcript,
      windowResult,
    }))

    await writeProgress({
      outputPaths,
      records,
      rosterRows,
      skippedNoRoster,
      startedAt,
      introSnippets,
      targetCount: targets.length,
      selectedCount: selected.length,
    })
  }

  const mergedRecords = await mergeRecords(outputPaths.candidates, records)
  const mergedIntroSnippets = await mergeIntroSnippets(outputPaths.introSnippets, introSnippets)
  const review = createReview(mergedRecords)
  const report = createReport({
    elapsedMs: Date.now() - startedAt,
    records: mergedRecords,
    rosterRows,
    skippedNoRoster,
    targetCount: targets.length,
    selectedCount: selected.length,
  })

  await mkdir(GENERATED_DIR, { recursive: true })
  await Promise.all([
    writeJson(outputPaths.candidates, mergedRecords),
    writeJson(outputPaths.introSnippets, mergedIntroSnippets),
    writeJson(outputPaths.review, review),
    writeJson(outputPaths.report, report),
  ])

  return { records: mergedRecords, report, review }
}

async function transcribeAndMatchTarget({
  options,
  resolvedTarget,
  roster,
}) {
  if (!options.autoWindow) {
    return transcribeAndMatchWindow({
      options,
      resolvedTarget,
      roster,
      start: options.start ?? 0,
      windowDuration: options.duration,
    })
  }

  const start = options.start ?? 0
  const windowDuration = options.windowDuration ?? 180
  const maxStart = Math.max(start, options.maxStart ?? start)
  const starts = []
  for (let current = start; current <= maxStart; current += windowDuration) starts.push(current)

  let bestResult = null
  for (const currentStart of starts) {
    const result = await transcribeAndMatchWindow({
      options,
      resolvedTarget,
      roster,
      start: currentStart,
      windowDuration,
    })
    if (!bestResult || windowScore(result) > windowScore(bestResult)) bestResult = result
    if (shouldStopWindowScan(result)) {
      return {
        ...result,
        scannedWindowCount: starts.indexOf(currentStart) + 1,
        windowStrategy: 'auto-window',
      }
    }
  }

  return {
    ...bestResult,
    scannedWindowCount: starts.length,
    windowStrategy: 'auto-window-best-effort',
  }
}

async function transcribeAndMatchWindow({
  options,
  resolvedTarget,
  roster,
  start,
  windowDuration,
}) {
  const windowTarget = {
    ...resolvedTarget,
    matchId: options.autoWindow
      ? `${resolvedTarget.matchId}__s${start}`
      : resolvedTarget.matchId,
  }
  const audio = await extractOpeningAudio(windowTarget, {
    ...options,
    duration: windowDuration,
    start,
  })
  const transcript = await transcribeOpeningAudio(windowTarget, audio, {
    audioDuration: windowDuration,
    audioStart: start,
    cacheNamespace: CACHE_NAMESPACE,
    force: options.force,
    initialPrompt: roster.prompt,
    model: options.model,
  })
  const matched = matchRosterSpeakers({
    rosterContext: roster,
    transcriptText: transcript.transcriptText,
  })
  await cleanupAudioCache(audio, transcript, options)

  return {
    audio,
    matched,
    transcript,
    windowStart: start,
    windowDuration,
    windowStrategy: options.autoWindow ? 'auto-window' : 'single-window',
  }
}

function shouldStopWindowScan(result) {
  const count = autoMergeSpeakerCount({ teams: result.matched.teams ?? [] })
  const completeTeams = (result.matched.teams ?? []).filter((team) => (
    (team.speakers ?? []).filter((speaker) => speaker.autoMerge !== false).length >= 3
  )).length
  const roleMarkerCount = Number(result.matched.roleMarkerCount ?? 0)
  return count >= 8
    || (count >= 6 && completeTeams >= 2)
    || (count >= 4 && completeTeams >= 1 && roleMarkerCount >= 8)
}

function windowScore(result) {
  const count = autoMergeSpeakerCount({ teams: result.matched.teams ?? [] })
  const roleMarkerCount = Number(result.matched.roleMarkerCount ?? 0)
  const confidence = (result.matched.teams ?? [])
    .flatMap((team) => team.speakers ?? [])
    .filter((speaker) => speaker.autoMerge !== false)
    .reduce((total, speaker) => total + Number(speaker.confidence ?? 0), 0)
  return count * 100 + roleMarkerCount * 5 + confidence
}

function selectJanMainTargets(matches) {
  const officialStageWords = ['初赛', '复赛', '半决赛', '决赛']
  const excludedStageWords = ['表演赛', '哲理', '新锐', '跨界', '1V1', '2V2']
  return matches
    .filter((match) => String(match.date ?? '').startsWith('2024-01'))
    .filter((match) => match.event === '2024新国辩')
    .filter((match) => officialStageWords.some((word) => String(match.stage ?? '').includes(word)))
    .filter((match) => !excludedStageWords.some((word) => String(match.stage ?? '').includes(word)))
    .filter((match) => Array.isArray(match.teams) && match.teams.length === 2)
    .map(createTarget)
    .sort((left, right) => String(left.date).localeCompare(String(right.date))
      || String(left.stage).localeCompare(String(right.stage))
      || String(left.matchId).localeCompare(String(right.matchId)))
}

function createTarget(match) {
  const partIndex = resolvePartIndex(match)
  const pages = Array.isArray(match.raw?.pages) ? match.raw.pages : []
  const page = pages.find((item) => Number(item.page ?? 1) === partIndex) ?? pages[0]
  const cid = match.raw?.cid ?? page?.cid ?? null
  const isMultipart = partIndex > 1 || pages.length > 1 || /-p\d+$/.test(match.id)
  const warnings = []

  if (!cid) warnings.push('缺少 cid；yt-dlp 仍可尝试单 P URL，但定位可靠性降低。')
  if (isMultipart && (!cid || !partIndex)) {
    warnings.push('多 P 视频缺少 cid 或 partIndex，禁止自动处理。')
  }

  return {
    matchId: match.id,
    bvId: match.bvId,
    cid,
    partIndex,
    page: partIndex,
    bilibiliUrl: match.bilibiliUrl,
    title: match.title,
    event: match.event,
    stage: match.stage,
    date: match.date,
    teams: match.teams,
    year: YEAR,
    isMultipart,
    processable: !(isMultipart && (!cid || !partIndex)),
    warnings,
  }
}

function resolvePartIndex(match) {
  const rawPart = Number(match.raw?.partNumber ?? match.raw?.page ?? 0)
  if (rawPart > 0) return rawPart
  try {
    return positiveNumber(new URL(match.bilibiliUrl).searchParams.get('p'), 1)
  } catch {
    return 1
  }
}

function createRecord({
  audio,
  matched,
  resolvedTarget,
  roster,
  target,
  transcript,
  windowResult,
}) {
  return {
    audioDuration: transcript.audioDuration,
    audioStart: transcript.audioStart,
    audioStatus: audio.status,
    bilibiliUrl: target.bilibiliUrl,
    bvId: target.bvId,
    cid: resolvedTarget.cid,
    date: target.date,
    event: target.event,
    matchId: target.matchId,
    partIndex: target.partIndex,
    roleMarkerCount: matched.roleMarkerCount,
    stage: target.stage,
    teams: matched.teams,
    title: target.title,
    transcriptStatus: transcript.status,
    windowStrategy: windowResult.windowStrategy,
    scannedWindowCount: windowResult.scannedWindowCount ?? 1,
    warnings: uniqueWarnings([
      ...target.warnings,
      ...resolvedTarget.warnings,
      ...roster.warnings,
      ...audio.warnings,
      ...transcript.warnings,
      ...matched.warnings,
    ]),
  }
}

async function writeProgress({
  outputPaths,
  records,
  rosterRows,
  skippedNoRoster,
  startedAt,
  introSnippets,
  targetCount,
  selectedCount,
}) {
  await mkdir(GENERATED_DIR, { recursive: true })
  const mergedRecords = await mergeRecords(outputPaths.candidates, records)
  const mergedIntroSnippets = await mergeIntroSnippets(outputPaths.introSnippets, introSnippets)
  const review = createReview(mergedRecords)
  const report = createReport({
    elapsedMs: Date.now() - startedAt,
    records: mergedRecords,
    rosterRows,
    skippedNoRoster,
    targetCount,
    selectedCount,
  })
  await Promise.all([
    writeJson(outputPaths.candidates, mergedRecords),
    writeJson(outputPaths.introSnippets, mergedIntroSnippets),
    writeJson(outputPaths.review, review),
    writeJson(outputPaths.report, report),
  ])
}

function createReview(records) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    year: YEAR,
    competitionType: COMPETITION_TYPE,
    scope: SCOPE,
    purpose: '2024 年 1 月第十一届新国辩正赛名单约束识别复核清单；不自动合并低分候补。',
    records: records.map((record) => ({
      matchId: record.matchId,
      bvId: record.bvId,
      title: record.title,
      stage: record.stage,
      date: record.date,
      audioStart: record.audioStart,
      audioDuration: record.audioDuration,
      windowStrategy: record.windowStrategy,
      scannedWindowCount: record.scannedWindowCount,
      teams: record.teams.map((team) => ({
        team: team.team,
        speakers: team.speakers.map((speaker) => ({
          name: speaker.name,
          confidence: speaker.confidence,
          confidenceLevel: speaker.confidenceLevel,
          recognizedText: speaker.recognizedText,
          role: speaker.role,
          sourcePass: speaker.sourcePass,
          matchMethod: speaker.matchMethod,
          autoMerge: speaker.autoMerge,
          transcriptSnippet: speaker.transcriptSnippet,
        })),
      })),
      matchedSpeakerCount: speakerCount(record),
      autoMergeSpeakerCount: autoMergeSpeakerCount(record),
      reviewStatus: reviewStatus(autoMergeSpeakerCount(record)),
      warnings: record.warnings,
    })),
  }
}

function createReport({
  elapsedMs,
  records,
  rosterRows,
  skippedNoRoster,
  targetCount,
  selectedCount,
}) {
  const allSpeakers = records.flatMap((record) => (
    record.teams.flatMap((team) => team.speakers)
  ))
  const autoMergeSpeakers = allSpeakers.filter((speaker) => speaker.autoMerge !== false)
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    year: YEAR,
    competitionType: COMPETITION_TYPE,
    scope: SCOPE,
    mode: selectedCount === targetCount ? 'full' : 'sample',
    rosterEntryCount: rosterRows.length,
    rosterTeamCount: new Set(rosterRows.map((row) => row.team)).size,
    targetMatchCount: targetCount,
    selectedMatchCount: selectedCount,
    processedMatchCount: records.length,
    skippedNoRosterCount: skippedNoRoster.length,
    skippedNoRoster: skippedNoRoster.map(({ roster, target }) => ({
      matchId: target.matchId,
      teams: target.teams,
      title: target.title,
      warnings: roster.warnings,
    })),
    transcriptionSuccessCount: records.filter((record) => (
      ['success', 'cached'].includes(record.transcriptStatus)
    )).length,
    matchedVideoCount: records.filter((record) => speakerCount(record) > 0).length,
    autoMergeVideoCount: records.filter((record) => autoMergeSpeakerCount(record) > 0).length,
    matchedSpeakerCount: allSpeakers.length,
    autoMergeSpeakerCount: autoMergeSpeakers.length,
    highMatchCount: allSpeakers.filter((speaker) => speaker.confidenceLevel === 'high').length,
    mediumMatchCount: allSpeakers.filter((speaker) => speaker.confidenceLevel === 'medium').length,
    lowMatchCount: allSpeakers.filter((speaker) => speaker.confidenceLevel === 'low').length,
    completeEightSpeakerCount: records.filter((record) => autoMergeSpeakerCount(record) >= 8).length,
    atLeastSixSpeakerCount: records.filter((record) => autoMergeSpeakerCount(record) >= 6).length,
    atLeastFourSpeakerCount: records.filter((record) => autoMergeSpeakerCount(record) >= 4).length,
    totalElapsedMs: elapsedMs,
    selectedMatches: records.map((record) => ({
      matchId: record.matchId,
      title: record.title,
      stage: record.stage,
      audioStart: record.audioStart,
      audioDuration: record.audioDuration,
      windowStrategy: record.windowStrategy,
      scannedWindowCount: record.scannedWindowCount,
      teams: record.teams.map((team) => ({
        team: team.team,
        speakers: team.speakers
          .filter((speaker) => speaker.autoMerge !== false)
          .map((speaker) => speaker.name),
      })),
      matchedSpeakerCount: speakerCount(record),
      autoMergeSpeakerCount: autoMergeSpeakerCount(record),
      transcriptStatus: record.transcriptStatus,
      reviewStatus: reviewStatus(autoMergeSpeakerCount(record)),
    })),
    notes: [
      '本报告不修改 generatedMatches.json。',
      '正式卡片只能合并 autoMerge=true 或人工确认的人名。',
      '低分候选只保留在复核报告中，不能为了补满人数自动入库。',
      '音频缓存可用 --cleanup-audio 在转写文本生成后删除；intro 文本缓存会保留。',
    ],
  }
}

function createOutputPaths() {
  return {
    candidates: path.join(GENERATED_DIR, `rosterSpeakerCandidates.${YEAR}.${SCOPE}.json`),
    introSnippets: path.join(GENERATED_DIR, `speakerIntroSnippets.${YEAR}.${SCOPE}.json`),
    review: path.join(GENERATED_DIR, `rosterSpeakerReview.${YEAR}.${SCOPE}.json`),
    report: path.join(GENERATED_DIR, `rosterSpeakerReport.${YEAR}.${SCOPE}.json`),
  }
}

function speakerCount(record) {
  return record.teams.reduce((total, team) => total + (team.speakers?.length ?? 0), 0)
}

function autoMergeSpeakerCount(record) {
  return record.teams.reduce((total, team) => (
    total + (team.speakers ?? []).filter((speaker) => speaker.autoMerge !== false).length
  ), 0)
}

function reviewStatus(count) {
  if (count >= 8) return 'complete'
  if (count >= 6) return 'usable'
  if (count >= 4) return 'minimum-usable'
  return 'needs-review'
}

function uniqueWarnings(warnings) {
  return [...new Set(warnings.filter(Boolean))]
}

async function mergeRecords(filePath, records) {
  const existing = await readOptionalJson(filePath)
  const recordByMatchId = new Map(
    (Array.isArray(existing) ? existing : []).map((record) => [record.matchId, record]),
  )
  for (const record of records) recordByMatchId.set(record.matchId, record)
  return [...recordByMatchId.values()]
    .sort((left, right) => String(left.date).localeCompare(String(right.date))
      || String(left.matchId).localeCompare(String(right.matchId)))
}

async function mergeIntroSnippets(filePath, records) {
  const existing = await readOptionalJson(filePath)
  const recordByMatchId = new Map(
    (existing?.snippets ?? []).map((record) => [record.matchId, record]),
  )
  for (const record of records) recordByMatchId.set(record.matchId, record)
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose: '缓存 2024 年 1 月正赛每场开场自我介绍片段，便于名单修正后快速重匹配。',
    snippets: [...recordByMatchId.values()]
      .sort((left, right) => String(left.date).localeCompare(String(right.date))
        || String(left.matchId).localeCompare(String(right.matchId))),
  }
}

async function readNonEmptyIntroSnippetIds(filePath) {
  const payload = await readOptionalJson(filePath)
  return new Set((payload?.snippets ?? [])
    .filter((record) => record.introText)
    .map((record) => record.matchId))
}

async function cleanupAudioCache(audio, transcript, options) {
  if (!options.cleanupAudio || !transcript.transcriptText || !audio.audioPath) return
  if (!isPathInside(audio.audioPath, AUDIO_CACHE_DIR)) return

  try {
    await unlink(audio.audioPath)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

function isPathInside(filePath, parentPath) {
  const relativePath = path.relative(parentPath, filePath)
  return Boolean(relativePath)
    && !relativePath.startsWith('..')
    && !path.isAbsolute(relativePath)
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

async function readOptionalJson(filePath) {
  try {
    return await readJson(filePath)
  } catch {
    return null
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function positiveNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

async function runCli() {
  const options = {
    ...parseCliOptions(),
    year: YEAR,
  }
  const { report } = await buildRoster2024JanMainReport(options)
  console.log(
    `[speakers:roster:${YEAR}:jan-main] `
    + `${report.processedMatchCount}/${report.targetMatchCount} 场已处理，`
    + `${report.autoMergeVideoCount} 场有可入库姓名，`
    + `共 ${report.autoMergeSpeakerCount} 名。`,
  )
  console.log('[speakers:roster:2024:jan-main] 报告已写入 src/data/generated。')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(`[speakers:roster:2024:jan-main] ${error?.message ?? error}`)
    process.exitCode = 1
  })
}
