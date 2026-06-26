import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { extractOpeningAudio } from './extractOpeningAudio.js'
import { matchRosterSpeakers } from './matchRosterSpeakers.js'
import { mergeRosterSpeakerResults } from './mergeRosterSpeakerResults.js'
import {
  GENERATED_DIR,
  AUDIO_CACHE_DIR,
  parseCliOptions,
  selectSpeakerTargets,
} from './selectSpeakerTargets.js'
import { loadTeamRoster, resolveTargetRoster } from './teamRoster.js'
import { transcribeOpeningAudio } from './transcribeOpeningAudio.js'
import { resolveTargetMedia } from './resolveTargetMedia.js'
import { createIntroSnippetRecord } from './transcriptIntroSnippet.js'
import { isQualificationScopeMatch } from './qualificationScope.js'

export async function buildRosterConstrainedReport(options = {}) {
  const startedAt = Date.now()
  const limit = options.all ? Number.POSITIVE_INFINITY : options.limit ?? 5
  const year = options.year ?? 2025
  const outputPaths = createOutputPaths(options.all, year)
  const rosterRows = await loadTeamRoster({ year })
  const baseManifest = await selectSpeakerTargets({ limit: 500, write: false, year })
  const existingIntroSnippetIds = options.missingIntroOnly
    ? await readNonEmptyIntroSnippetIds(outputPaths.introSnippets)
    : null
  const rosterCandidates = baseManifest.targets
    .filter((target) => isQualificationScopeMatch(target, { year }))
    .map((target) => ({ target, roster: resolveTargetRoster(target, rosterRows) }))
  const skippedNoRoster = rosterCandidates.filter((item) => !item.roster.covered)
  const eligible = rosterCandidates
    .filter((item) => item.roster.covered && item.target.processable)
    .filter((item) => !existingIntroSnippetIds?.has(item.target.matchId))
  const selected = options.all ? eligible : selectDiverseRosterTargets(eligible, limit)
  const records = []
  const commandLabel = options.all ? `speakers:roster:${year}` : `speakers:roster:sample:${year}`
  const introSnippets = []

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
    const audio = await extractOpeningAudio(resolvedTarget, options)
    const transcript = await transcribeOpeningAudio(resolvedTarget, audio, {
      audioDuration: options.duration,
      audioStart: 0,
      cacheNamespace: `roster-${year}-qualification`,
      force: options.force,
      initialPrompt: roster.prompt,
      model: options.model,
    })
    const matched = matchRosterSpeakers({
      rosterContext: roster,
      transcriptText: transcript.transcriptText,
    })
    introSnippets.push(createIntroSnippetRecord({
      matched,
      target: resolvedTarget,
      transcript,
    }))
    await cleanupAudioCache(audio, transcript, options)
    records.push({
      audioStatus: audio.status,
      bilibiliUrl: target.bilibiliUrl,
      bvId: target.bvId,
      cid: resolvedTarget.cid,
      matchId: target.matchId,
      partIndex: target.partIndex,
      roleMarkerCount: matched.roleMarkerCount,
      stage: target.stage,
      teams: matched.teams,
      title: target.title,
      transcriptStatus: transcript.status,
      warnings: uniqueWarnings([
        ...target.warnings,
        ...resolvedTarget.warnings,
        ...roster.warnings,
        ...audio.warnings,
        ...transcript.warnings,
        ...matched.warnings,
      ]),
    })
    if (!options.merge) {
      await writeProgress({
        eligibleCount: eligible.length,
        outputPaths,
        records,
        rosterRows,
        skippedNoRoster,
        startedAt,
        introSnippets,
        options,
        year,
      })
    }
  }

  const mergeResult = options.merge
    ? await mergeRosterSpeakerResults(records, {
      acceptLowConfidence: options.acceptLowConfidence,
    })
    : null
  const report = createReport({
    elapsedMs: Date.now() - startedAt,
    eligibleCount: eligible.length,
    mergeResult,
    mode: options.all ? 'full' : 'sample',
    records: options.merge ? records : await mergeRecords(outputPaths.candidates, records),
    rosterRows,
    skippedNoRoster,
    options,
    year,
  })
  await mkdir(GENERATED_DIR, { recursive: true })
  const mergedIntroSnippets = await mergeIntroSnippets(outputPaths.introSnippets, introSnippets)
  const mergedRecords = options.merge ? records : await mergeRecords(outputPaths.candidates, records)
  await Promise.all([
    writeJson(outputPaths.candidates, mergedRecords),
    writeJson(outputPaths.introSnippets, mergedIntroSnippets),
    writeJson(outputPaths.report, report),
  ])
  return { records, report }
}

async function writeProgress({
  eligibleCount,
  outputPaths,
  records,
  rosterRows,
  skippedNoRoster,
  startedAt,
  introSnippets,
  options,
  year,
}) {
  await mkdir(GENERATED_DIR, { recursive: true })
  const mergedIntroSnippets = await mergeIntroSnippets(outputPaths.introSnippets, introSnippets)
  const mergedRecords = await mergeRecords(outputPaths.candidates, records)
  const report = createReport({
    elapsedMs: Date.now() - startedAt,
    eligibleCount,
    mergeResult: null,
    mode: options.all ? 'full' : 'sample',
    records: mergedRecords,
    rosterRows,
    skippedNoRoster,
    options,
    year,
  })
  await Promise.all([
    writeJson(outputPaths.candidates, mergedRecords),
    writeJson(outputPaths.introSnippets, mergedIntroSnippets),
    writeJson(outputPaths.report, report),
  ])
}

function selectDiverseRosterTargets(items, limit) {
  const selected = []
  const titles = new Set()
  for (const item of items) {
    if (selected.length >= limit) break
    if (titles.has(item.target.title)) continue
    selected.push(item)
    titles.add(item.target.title)
  }
  for (const item of items) {
    if (selected.length >= limit) break
    if (selected.includes(item)) continue
    selected.push(item)
  }
  return selected
}

function createReport({
  elapsedMs,
  eligibleCount,
  mergeResult,
  mode,
  records,
  rosterRows,
  skippedNoRoster,
  options,
  year,
}) {
  const allSpeakers = records.flatMap((record) => (
    record.teams.flatMap((team) => team.speakers)
  ))
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    year,
    competitionType: '资格赛',
    mode,
    rosterEntryCount: rosterRows.length,
    rosterTeamCount: new Set(rosterRows.map((row) => row.team)).size,
    rosterCoveredMissingMatchCount: eligibleCount,
    skippedNoRosterCount: skippedNoRoster.length,
    skippedNoRoster: skippedNoRoster.map(({ roster, target }) => ({
      matchId: target.matchId,
      teams: target.teams,
      title: target.title,
      warnings: roster.warnings,
    })),
    sampleSize: records.length,
    transcriptionSuccessCount: records.filter((record) => (
      ['success', 'cached'].includes(record.transcriptStatus)
    )).length,
    matchedVideoCount: records.filter((record) => speakerCount(record) > 0).length,
    completeEightSpeakerCount: records.filter((record) => (
      record.teams.length === 2 && record.teams.every((team) => team.speakers.length === 4)
    )).length,
    matchedSpeakerCount: allSpeakers.length,
    highMatchCount: allSpeakers.filter((speaker) => speaker.confidenceLevel === 'high').length,
    mediumMatchCount: allSpeakers.filter((speaker) => speaker.confidenceLevel === 'medium').length,
    lowMatchCount: allSpeakers.filter((speaker) => speaker.confidenceLevel === 'low').length,
    totalElapsedMs: elapsedMs,
    mergeResult,
    mergeOptions: {
      acceptLowConfidence: Boolean(options.acceptLowConfidence),
    },
    selectedMatches: records.map((record) => ({
      matchId: record.matchId,
      title: record.title,
      teams: record.teams.map((team) => ({
        team: team.team,
        speakers: team.speakers.map((speaker) => speaker.name),
      })),
      matchedSpeakerCount: speakerCount(record),
      transcriptStatus: record.transcriptStatus,
    })),
    notes: [
      mergeResult
        ? '已将名单姓名合并进 generatedMatches.json。默认只合并通过门槛的姓名；如 acceptLowConfidence 为 true，则包含低置信候选。'
        : '当前为只读 sample，不会写回 generatedMatches.json。',
      '如使用 --missing-intro-only，本报告只包含尚无自我介绍片段缓存的目标。',
      '如使用 --cleanup-audio，会在转写文本可用后删除本地 wav 音频缓存。',
      '同音或模糊匹配仍需人工复核。',
    ],
  }
}

function createOutputPaths(isFullRun, year) {
  const suffix = isFullRun ? '' : '.sample'
  return {
    candidates: path.join(
      GENERATED_DIR,
      `rosterSpeakerCandidates.${year}.qualification${suffix}.json`,
    ),
    introSnippets: path.join(
      GENERATED_DIR,
      `speakerIntroSnippets.${year}.qualification${suffix}.json`,
    ),
    report: path.join(
      GENERATED_DIR,
      `rosterSpeakerReport.${year}.qualification${suffix}.json`,
    ),
  }
}

function speakerCount(record) {
  return record.teams.reduce((total, team) => total + team.speakers.length, 0)
}

function uniqueWarnings(warnings) {
  return [...new Set(warnings.filter(Boolean))]
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
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
    purpose: '缓存每场缺辩手视频的开场自我介绍片段，便于名单修正后快速重匹配。',
    snippets: [...recordByMatchId.values()]
      .sort((left, right) => String(left.date).localeCompare(String(right.date))
        || String(left.matchId).localeCompare(String(right.matchId))),
  }
}

async function mergeRecords(filePath, records) {
  const existing = await readOptionalJson(filePath)
  const recordByMatchId = new Map(
    (Array.isArray(existing) ? existing : []).map((record) => [record.matchId, record]),
  )
  for (const record of records) recordByMatchId.set(record.matchId, record)

  return [...recordByMatchId.values()]
    .sort((left, right) => String(left.matchId).localeCompare(String(right.matchId)))
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    return null
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

async function runCli() {
  const options = parseCliOptions()
  const { report } = await buildRosterConstrainedReport(options)
  const commandLabel = options.all ? `speakers:roster:${options.year}` : `speakers:roster:sample:${options.year}`
  console.log(
    `[${commandLabel}] ${report.sampleSize} 条视频，`
    + `${report.matchedVideoCount} 条产生名单匹配，共 ${report.matchedSpeakerCount} 名候选。`,
  )
  if (report.mergeResult) {
    console.log(
      `[${commandLabel}] 已合并 ${report.mergeResult.mergedMatchCount} 场、`
      + `${report.mergeResult.mergedSpeakerCount} 名辩手。`,
    )
  }
  console.log(`[${commandLabel}] 报告已写入 src/data/generated。`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(`[speakers:roster] ${error?.message ?? error}`)
    process.exitCode = 1
  })
}
