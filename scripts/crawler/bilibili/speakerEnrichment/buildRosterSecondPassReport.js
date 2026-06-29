import { mkdir, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { matchRosterSpeakers } from './matchRosterSpeakers.js'
import { GENERATED_DIR, parseCliOptions } from './selectSpeakerTargets.js'
import { loadTeamRoster, normalizeTeamName, resolveTargetRoster } from './teamRoster.js'

const DEFAULT_YEAR = 2024
const EXPECTED_SPEAKERS_PER_MATCH = 8
const MAX_COMPLETION_POOL_SIZE = 7
const MAX_SPEAKERS_PER_TEAM = 4

async function buildRosterSecondPassReport(options = {}) {
  const year = options.year ?? DEFAULT_YEAR
  const outputPaths = createOutputPaths(year)
  const rosterMode = year === 2024 ? 'verifiedCombined' : 'verified'
  const [firstPassRecords, snippetPayload, rosterRows, stageRosterRows, manualVerifications] = await Promise.all([
    readJson(outputPaths.firstPassCandidates),
    readJson(outputPaths.introSnippets),
    loadTeamRoster({ mode: rosterMode, year }),
    loadTeamRoster({ mode: rosterMode, year }),
    readOptionalJson(outputPaths.manualVerifications),
  ])
  const firstPassByMatchId = new Map(firstPassRecords.map((record) => [record.matchId, record]))
  const manualVerificationByMatchId = createManualVerificationMap(manualVerifications)
  const snippets = snippetPayload.snippets ?? []
  const targetSnippets = snippets

  const records = targetSnippets.map((snippet) => {
    const firstPass = firstPassByMatchId.get(snippet.matchId)
    const target = snippetToTarget(snippet)
    const stageRoster = resolveStageAwareTargetRoster(target, {
      fallbackRows: rosterRows,
      stageRows: stageRosterRows,
    })
    const fallbackRoster = resolveTargetRoster(target, rosterRows)
    const stageSecondPass = stageRoster.covered
      ? matchRosterSpeakers({
        rosterContext: stageRoster,
        strategy: 'secondPass',
        transcriptText: snippet.introText,
      })
      : { roleMarkerCount: 0, teams: [], warnings: stageRoster.warnings }
    const fallbackSecondPass = fallbackRoster.covered
      ? matchRosterSpeakers({
        rosterContext: fallbackRoster,
        strategy: 'secondPass',
        transcriptText: snippet.introText,
      })
      : { roleMarkerCount: 0, teams: [], warnings: fallbackRoster.warnings }
    const secondPassTeams = combineTeams(stageSecondPass.teams, fallbackSecondPass.teams)
    const combinedTeams = addManualVerifiedSpeakers({
      manualVerificationByMatchId,
      matchId: target.matchId,
      teams: secondPassTeams,
    })
    const expandedTeams = addTightRosterCompletionCandidates({
      fallbackRows: rosterRows,
      stageRows: stageRosterRows,
      target,
      teams: combinedTeams,
    })
    const baselineCount = speakerCount(firstPass)
    const secondPassCount = teamSpeakerCount(secondPassTeams)
    const combinedCount = teamSpeakerCount(combinedTeams)
    const expandedCount = teamExpandedSpeakerCount(expandedTeams)
    const manualVerificationCount = combinedTeams.reduce((total, team) => (
      total + (team.speakers ?? []).filter((speaker) => (
        speaker.sourcePass === 'manualVerification'
      )).length
    ), 0)

    return {
      matchId: snippet.matchId,
      bvId: snippet.bvId,
      cid: snippet.cid,
      partIndex: snippet.partIndex,
      page: snippet.page,
      bilibiliUrl: snippet.bilibiliUrl,
      title: snippet.title,
      event: snippet.event,
      stage: snippet.stage,
      date: snippet.date,
      teams: combinedTeams,
      expandedTeams,
      baselineTeams: firstPass?.teams ?? [],
      secondPassTeams,
      baselineSpeakerCount: baselineCount,
      secondPassSpeakerCount: secondPassCount,
      matchedSpeakerCount: combinedCount,
      expandedSpeakerCount: expandedCount,
      manualVerificationCount,
      completionCandidateCount: expandedTeams.reduce((total, team) => (
        total + (team.completionCandidates?.length ?? 0)
      ), 0),
      addedSpeakerCount: Math.max(0, combinedCount - baselineCount),
      missingSpeakerCount: Math.max(0, EXPECTED_SPEAKERS_PER_MATCH - combinedCount),
      expandedMissingSpeakerCount: Math.max(0, EXPECTED_SPEAKERS_PER_MATCH - expandedCount),
      roleMarkerCount: stageSecondPass.roleMarkerCount
        || fallbackSecondPass.roleMarkerCount
        || snippet.roleMarkerCount
        || 0,
      transcriptStatus: snippet.transcriptStatus,
      reviewStatus: reviewStatus(combinedCount),
      expandedReviewStatus: reviewStatus(expandedCount),
      rosterCovered: stageRoster.covered || fallbackRoster.covered,
      warnings: uniqueWarnings([
        ...(snippet.warnings ?? []),
        ...(stageRoster.warnings ?? []),
        ...(fallbackRoster.warnings ?? []),
        ...(stageSecondPass.warnings ?? []),
        ...(fallbackSecondPass.warnings ?? []),
        combinedCount < 4 ? '二次展开后仍低于 4 人，建议人工核查或换更强转写模型。' : '',
      ]),
    }
  })

  const review = createReview(records, year)
  const report = createReport({
    firstPassRecords,
    records,
    review,
    targetSnippets,
    year,
  })
  await mkdir(GENERATED_DIR, { recursive: true })
  await Promise.all([
    writeJson(outputPaths.secondPassCandidates, records),
    writeJson(outputPaths.secondPassReview, review),
    writeJson(outputPaths.secondPassReport, report),
  ])
  return { records, report, review }
}

function addTightRosterCompletionCandidates({
  fallbackRows,
  stageRows,
  target,
  teams,
}) {
  return teams.map((team) => {
    const members = resolveTeamMembers({
      fallbackRows,
      groupLetters: extractGroupLetters(target),
      matchTeam: team.team,
      stageRows,
      stageSegment: inferStageSegment(target),
    })
    const speakerNames = new Set((team.speakers ?? []).map((speaker) => speaker.name))
    const canUseCompletionPool = members.length > 0 && members.length <= MAX_COMPLETION_POOL_SIZE
    const completionCandidates = canUseCompletionPool
      ? members
        .filter((name) => !speakerNames.has(name))
        .map((name) => ({
          name,
          confidence: 0.3,
          confidenceLevel: 'candidate',
          matchMethod: `tight-roster-pool-${members.length}`,
          sourcePass: 'tightRosterCompletion',
        }))
      : []
    return {
      ...team,
      completionCandidates,
      completionPoolSize: members.length,
      expandedSpeakerCount: Math.min(
        MAX_SPEAKERS_PER_TEAM,
        (team.speakers?.length ?? 0) + completionCandidates.length,
      ),
    }
  })
}

function snippetToTarget(snippet) {
  return {
    matchId: snippet.matchId,
    bvId: snippet.bvId,
    cid: snippet.cid,
    partIndex: snippet.partIndex,
    page: snippet.page,
    bilibiliUrl: snippet.bilibiliUrl,
    title: snippet.title,
    event: snippet.event,
    stage: snippet.stage,
    date: snippet.date,
    teams: snippet.teams,
    year: snippet.year,
    processable: true,
    warnings: snippet.warnings ?? [],
  }
}

function createManualVerificationMap(payload) {
  return new Map((payload?.records ?? []).map((record) => [record.matchId, record]))
}

function addManualVerifiedSpeakers({
  manualVerificationByMatchId,
  matchId,
  teams,
}) {
  const verification = manualVerificationByMatchId.get(matchId)
  if (!verification) return teams

  return teams.map((team) => {
    const verifiedTeam = (verification.teams ?? []).find((item) => item.team === team.team)
    if (!verifiedTeam) return team

    const speakerByName = new Map((team.speakers ?? []).map((speaker) => [speaker.name, speaker]))
    for (const name of verifiedTeam.speakers ?? []) {
      speakerByName.set(name, {
        ...(speakerByName.get(name) ?? {}),
        name,
        confidence: 0.99,
        confidenceLevel: 'verified',
        autoMerge: true,
        matchMethod: 'manual-verification',
        sourcePass: 'manualVerification',
        verifiedBy: verification.verifiedBy ?? 'user',
        verifiedAt: verification.verifiedAt ?? '',
      })
    }

    return {
      ...team,
      speakers: [...speakerByName.values()].slice(0, MAX_SPEAKERS_PER_TEAM),
    }
  })
}

function resolveStageAwareTargetRoster(target, {
  fallbackRows,
  stageRows,
}) {
  const stageSegment = inferStageSegment(target)
  const groupLetters = extractGroupLetters(target)
  const teamContexts = (target.teams ?? []).map((matchTeam) => {
    const members = resolveTeamMembers({
      fallbackRows,
      groupLetters,
      matchTeam,
      stageRows,
      stageSegment,
    })
    return {
      matchTeam,
      members,
      rosterTeam: members.rosterTeam,
    }
  })
  const warnings = []
  if (teamContexts.length !== 2) warnings.push('比赛数据未提供完整的双方队伍。')
  for (const team of teamContexts) {
    if (!team.rosterTeam) warnings.push(`名单库中找不到队伍：${team.matchTeam}`)
    if (team.rosterTeam && team.members.length === 0) warnings.push(`队伍没有报名人员：${team.rosterTeam}`)
  }
  const covered = teamContexts.length === 2 && teamContexts.every((team) => team.members.length > 0)
  if (!covered) return resolveTargetRoster(target, fallbackRows)

  return {
    competitionType: '资格赛',
    covered,
    prompt: '',
    stageSegment,
    teams: teamContexts.map((team) => ({
      matchTeam: team.matchTeam,
      members: team.members,
      rosterTeam: team.rosterTeam,
    })),
    warnings,
    year: target.year,
  }
}

function resolveTeamMembers({
  fallbackRows,
  groupLetters,
  matchTeam,
  stageRows,
  stageSegment,
}) {
  const normalizedMatchTeam = normalizeTeamName(matchTeam)
  const stageTeamRows = stageRows.filter((row) => (
    rowStageSegment(row) === stageSegment
    && teamsMatchByName(row.team, normalizedMatchTeam)
  ))
  const groupRows = groupLetters.length
    ? stageTeamRows.filter((row) => (
      rowTeamCodes(row).some((teamCode) => groupLetters.includes(teamCode[0]))
    ))
    : []
  const fallbackStageRows = stageTeamRows.length ? stageTeamRows : stageRows.filter((row) => (
    teamsMatchByName(row.team, normalizedMatchTeam)
  ))
  const finalRows = groupRows.length ? groupRows : fallbackStageRows
  const fallbackTeamRows = fallbackRows.filter((row) => teamsMatchByName(row.team, normalizedMatchTeam))
  const rows = finalRows.length ? finalRows : fallbackTeamRows
  const rosterTeam = rows[0]?.team ?? ''
  const members = [...new Set(rows.map((row) => row.name).filter(Boolean))]
  members.rosterTeam = rosterTeam
  return members
}

function rowStageSegment(row) {
  return row.stageSegment ?? row.segments ?? ''
}

function rowTeamCodes(row) {
  return String(row.teamCode ?? row.teamCodes ?? '')
    .split(/[、,，/|;\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)
}

function teamsMatchByName(left, normalizedRight) {
  const normalizedLeft = normalizeTeamName(left)
  return normalizedLeft === normalizedRight
    || normalizedLeft.includes(normalizedRight)
    || normalizedRight.includes(normalizedLeft)
}

function inferStageSegment(target) {
  const text = `${target.stage ?? ''} ${target.title ?? ''}`
  return text.includes('初赛') ? '线上赛段' : '线下赛段'
}

function extractGroupLetters(target) {
  const text = `${target.stage ?? ''} ${target.title ?? ''}`
  const matches = [...text.matchAll(/([A-Z]{1,4})组/g)]
  return [...new Set(matches.flatMap((match) => match[1].split('')))]
}

function combineTeams(firstPassTeams, secondPassTeams) {
  const maxLength = Math.max(firstPassTeams.length, secondPassTeams.length)
  return Array.from({ length: maxLength }, (_, teamIndex) => {
    const firstTeam = firstPassTeams[teamIndex] ?? {}
    const secondTeam = secondPassTeams[teamIndex] ?? {}
    const speakersByName = new Map()

    for (const speaker of firstTeam.speakers ?? []) {
      speakersByName.set(speaker.name, {
        ...speaker,
        sourcePass: 'firstPass',
      })
    }
    for (const speaker of secondTeam.speakers ?? []) {
      const existing = speakersByName.get(speaker.name)
      if (!existing || Number(speaker.confidence ?? 0) > Number(existing.confidence ?? 0)) {
        speakersByName.set(speaker.name, {
          ...speaker,
          sourcePass: existing ? 'both' : 'secondPass',
        })
      }
    }

    return {
      team: firstTeam.team || secondTeam.team || '',
      speakers: [...speakersByName.values()]
        .sort((left, right) => Number(right.confidence ?? 0) - Number(left.confidence ?? 0))
        .slice(0, MAX_SPEAKERS_PER_TEAM),
    }
  })
}

function createReview(records, year) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    year,
    purpose: `${year} 资格赛缓存自我介绍文本的二次展开复核清单；只读缓存文本，不下载音频，不合并页面。`,
    records: records.map((record) => ({
      matchId: record.matchId,
      bvId: record.bvId,
      title: record.title,
      stage: record.stage,
      date: record.date,
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
          transcriptSnippet: speaker.transcriptSnippet,
        })),
        completionCandidates: record.expandedTeams
          .find((expandedTeam) => expandedTeam.team === team.team)
          ?.completionCandidates ?? [],
      })),
      baselineSpeakerCount: record.baselineSpeakerCount,
      secondPassSpeakerCount: record.secondPassSpeakerCount,
      matchedSpeakerCount: record.matchedSpeakerCount,
      expandedSpeakerCount: record.expandedSpeakerCount,
      manualVerificationCount: record.manualVerificationCount,
      completionCandidateCount: record.completionCandidateCount,
      addedSpeakerCount: record.addedSpeakerCount,
      reviewStatus: record.reviewStatus,
      expandedReviewStatus: record.expandedReviewStatus,
      warnings: record.warnings,
    })),
  }
}

function createReport({
  firstPassRecords,
  records,
  review,
  targetSnippets,
  year,
}) {
  const firstPassTargetCount = targetSnippets.length
  const targetMatchIds = new Set(targetSnippets.map((snippet) => snippet.matchId))
  const nonTargetRecords = firstPassRecords.filter((record) => !targetMatchIds.has(record.matchId))
  const belowFourBefore = targetSnippets.filter((snippet) => {
    const firstPass = firstPassRecords.find((record) => record.matchId === snippet.matchId)
    return speakerCount(firstPass) < 4
  }).length
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    year,
    competitionType: '资格赛',
    mode: 'secondPass',
    source: {
      firstPassCandidates: createOutputPaths(year).firstPassCandidates,
      introSnippets: createOutputPaths(year).introSnippets,
    },
    targetRule: `使用 ${year} 校准后巡礼名单，处理全部缓存自我介绍文本，基于队伍名单约束重匹配和候选扩展。`,
    targetMatchCount: firstPassTargetCount,
    belowFourBeforeCount: belowFourBefore,
    improvedMatchCount: records.filter((record) => record.addedSpeakerCount > 0).length,
    reachedAtLeastFourCount: records.filter((record) => record.matchedSpeakerCount >= 4).length,
    stillBelowFourCount: records.filter((record) => record.matchedSpeakerCount < 4).length,
    reachedAtLeastSixCount: records.filter((record) => record.matchedSpeakerCount >= 6).length,
    completeEightSpeakerCount: records.filter((record) => record.matchedSpeakerCount >= 8).length,
    expandedReachedAtLeastFourCount: records.filter((record) => record.expandedSpeakerCount >= 4).length,
    expandedReachedAtLeastSixCount: records.filter((record) => record.expandedSpeakerCount >= 6).length,
    expandedCompleteEightSpeakerCount: records.filter((record) => record.expandedSpeakerCount >= 8).length,
    overallConfirmedAtLeastFourCount: records.filter((record) => record.matchedSpeakerCount >= 4).length
      + nonTargetRecords.filter((record) => speakerCount(record) >= 4).length,
    overallConfirmedAtLeastSixCount: records.filter((record) => record.matchedSpeakerCount >= 6).length
      + nonTargetRecords.filter((record) => speakerCount(record) >= 6).length,
    overallExpandedAtLeastFourCount: records.filter((record) => record.expandedSpeakerCount >= 4).length
      + nonTargetRecords.filter((record) => speakerCount(record) >= 4).length,
    overallExpandedAtLeastSixCount: records.filter((record) => record.expandedSpeakerCount >= 6).length
      + nonTargetRecords.filter((record) => speakerCount(record) >= 6).length,
    completionPoolMaxSize: MAX_COMPLETION_POOL_SIZE,
    totalAddedSpeakerCount: records.reduce((total, record) => total + record.addedSpeakerCount, 0),
    totalCompletionCandidateCount: records.reduce((total, record) => (
      total + record.completionCandidateCount
    ), 0),
    totalMatchedSpeakerCount: records.reduce((total, record) => total + record.matchedSpeakerCount, 0),
    reviewStatusCounts: countBy(records.map((record) => record.reviewStatus)),
    expandedReviewStatusCounts: countBy(records.map((record) => record.expandedReviewStatus)),
    selectedMatches: review.records.map((record) => ({
      matchId: record.matchId,
      bvId: record.bvId,
      title: record.title,
      stage: record.stage,
      date: record.date,
      baselineSpeakerCount: record.baselineSpeakerCount,
      matchedSpeakerCount: record.matchedSpeakerCount,
      expandedSpeakerCount: record.expandedSpeakerCount,
      manualVerificationCount: record.manualVerificationCount,
      completionCandidateCount: record.completionCandidateCount,
      reviewStatus: record.reviewStatus,
      expandedReviewStatus: record.expandedReviewStatus,
      teams: record.teams.map((team) => ({
        team: team.team,
        speakers: team.speakers.map((speaker) => speaker.name),
        completionCandidates: team.completionCandidates.map((speaker) => speaker.name),
      })),
    })),
    notes: [
      '本报告不下载音频、不转写、不修改 generatedMatches.json。',
      `secondPass 会更重视“一辩/二辩/三辩/四辩”后的姓名窗口，并使用 ${year} 校准后巡礼名单约束。`,
      'expandedSpeakerCount 包含 tightRosterCompletion 候选，只表示待复核名单池，不等同于音频确认识别。',
      'tightRosterCompletion 不应自动合并进正式卡片；正式卡片应优先只使用转写文本直接匹配到的姓名。',
      '低置信候选仍需人工复核；不建议直接无审计合并。',
    ],
  }
}

function reviewStatus(count) {
  if (count >= 8) return 'complete'
  if (count >= 6) return 'usable'
  if (count >= 4) return 'minimum-usable'
  return 'needs-review'
}

function createOutputPaths(year) {
  const speakerEnrichmentDir = path.dirname(fileURLToPath(import.meta.url))
  return {
    firstPassCandidates: path.join(GENERATED_DIR, `rosterSpeakerCandidates.${year}.qualification.json`),
    introSnippets: path.join(GENERATED_DIR, `speakerIntroSnippets.${year}.qualification.json`),
    manualVerifications: path.join(
      speakerEnrichmentDir,
      'manualVerifications',
      `speaker_verifications_${year}_qualification.json`,
    ),
    secondPassCandidates: path.join(
      GENERATED_DIR,
      `rosterSpeakerCandidates.${year}.qualification.secondPass.json`,
    ),
    secondPassReview: path.join(
      GENERATED_DIR,
      `rosterSpeakerReview.${year}.qualification.secondPass.json`,
    ),
    secondPassReport: path.join(
      GENERATED_DIR,
      `rosterSpeakerReport.${year}.qualification.secondPass.json`,
    ),
  }
}

function speakerCount(record) {
  return teamSpeakerCount(record?.teams ?? [])
}

function teamSpeakerCount(teams = []) {
  return teams.reduce((total, team) => total + (team.speakers?.length ?? 0), 0)
}

function teamExpandedSpeakerCount(teams = []) {
  return teams.reduce((total, team) => total + (team.expandedSpeakerCount ?? (
    team.speakers?.length ?? 0
  )), 0)
}

function countBy(values) {
  return values.reduce((counts, value) => ({
    ...counts,
    [value]: (counts[value] ?? 0) + 1,
  }), {})
}

function uniqueWarnings(warnings) {
  return [...new Set(warnings.filter(Boolean))]
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

async function runCli() {
  const options = parseCliOptions()
  const { report } = await buildRosterSecondPassReport({
    ...options,
    year: options.year || DEFAULT_YEAR,
  })
  console.log(
    `[speakers:roster:${report.year}:second-pass] `
    + `${report.targetMatchCount} 场缓存目标，`
    + `${report.improvedMatchCount} 场有新增，`
    + `${report.reachedAtLeastFourCount} 场确认达到 4 人以上，`
    + `${report.expandedReachedAtLeastSixCount} 场候选扩展达到 6 人以上。`,
  )
  console.log('[speakers:roster:second-pass] 报告已写入 src/data/generated。')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(`[speakers:roster:second-pass] ${error?.message ?? error}`)
    process.exitCode = 1
  })
}
