import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { extractOpeningAudio } from './extractOpeningAudio.js'
import { matchRosterSpeakers } from './matchRosterSpeakers.js'
import { mergeRosterSpeakerResults } from './mergeRosterSpeakerResults.js'
import {
  GENERATED_DIR,
  parseCliOptions,
  selectSpeakerTargets,
} from './selectSpeakerTargets.js'
import { loadTeamRoster, resolveTargetRoster } from './teamRoster.js'
import { transcribeOpeningAudio } from './transcribeOpeningAudio.js'
import { resolveTargetMedia } from './resolveTargetMedia.js'

export async function buildRosterConstrainedReport(options = {}) {
  const startedAt = Date.now()
  const limit = options.all ? Number.POSITIVE_INFINITY : options.limit ?? 5
  const outputPaths = createOutputPaths(options.all)
  const rosterRows = await loadTeamRoster()
  const baseManifest = await selectSpeakerTargets({ limit: 200, write: false })
  const rosterCandidates = baseManifest.targets
    .filter((target) => target.stage.includes('资格赛'))
    .map((target) => ({ target, roster: resolveTargetRoster(target, rosterRows) }))
  const skippedNoRoster = rosterCandidates.filter((item) => !item.roster.covered)
  const eligible = rosterCandidates.filter((item) => item.roster.covered && item.target.processable)
  const selected = options.all ? eligible : selectDiverseRosterTargets(eligible, limit)
  const records = []
  const commandLabel = options.all ? 'speakers:roster:2025' : 'speakers:roster:sample:2025'

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
      cacheNamespace: 'roster-2025-qualification',
      force: options.force,
      initialPrompt: roster.prompt,
      model: options.model,
    })
    const matched = matchRosterSpeakers({
      rosterContext: roster,
      transcriptText: transcript.transcriptText,
    })
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
  }

  const mergeResult = options.merge
    ? await mergeRosterSpeakerResults(records)
    : null
  const report = createReport({
    elapsedMs: Date.now() - startedAt,
    eligibleCount: eligible.length,
    mergeResult,
    mode: options.all ? 'full' : 'sample',
    records,
    rosterRows,
    skippedNoRoster,
  })
  await mkdir(GENERATED_DIR, { recursive: true })
  await Promise.all([
    writeJson(outputPaths.candidates, records),
    writeJson(outputPaths.report, report),
  ])
  return { records, report }
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
}) {
  const allSpeakers = records.flatMap((record) => (
    record.teams.flatMap((team) => team.speakers)
  ))
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    year: 2025,
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
        ? '已将通过门槛的名单姓名合并进 generatedMatches.json。'
        : '当前为只读 sample，不会写回 generatedMatches.json。',
      '同音或模糊匹配仍需人工复核。',
    ],
  }
}

function createOutputPaths(isFullRun) {
  const suffix = isFullRun ? '' : '.sample'
  return {
    candidates: path.join(
      GENERATED_DIR,
      `rosterSpeakerCandidates.2025.qualification${suffix}.json`,
    ),
    report: path.join(
      GENERATED_DIR,
      `rosterSpeakerReport.2025.qualification${suffix}.json`,
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

async function runCli() {
  const options = parseCliOptions()
  const { report } = await buildRosterConstrainedReport(options)
  const commandLabel = options.all ? 'speakers:roster:2025' : 'speakers:roster:sample:2025'
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
    console.error(`[speakers:roster:sample:2025] ${error?.message ?? error}`)
    process.exitCode = 1
  })
}
