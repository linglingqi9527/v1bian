import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { GENERATED_DIR } from './selectSpeakerTargets.js'
import {
  assertPrivateStateUnchanged,
  privateStateSnapshot,
  refreshSpeakerReports,
} from './mergeRosterSpeakerResults.js'

const MATCHES_PATH = path.join(GENERATED_DIR, 'generatedMatches.json')
const MAX_SPEAKERS_PER_TEAM = 4

async function mergeRosterSecondPassResults({
  includeCompletionCandidates = false,
  year = 2024,
} = {}) {
  const candidatesPath = path.join(
    GENERATED_DIR,
    `rosterSpeakerCandidates.${year}.qualification.secondPass.json`,
  )
  const [matches, records] = await Promise.all([
    readJson(MATCHES_PATH),
    readJson(candidatesPath),
  ])
  const privateStateBefore = privateStateSnapshot(matches)
  const recordById = new Map(records.map((record) => [record.matchId, record]))
  let mergedMatchCount = 0
  let mergedSpeakerCount = 0

  const mergedMatches = matches.map((match) => {
    const record = recordById.get(match.id)
    if (!record) return match

    const accepted = collectAcceptedSpeakers(record, { includeCompletionCandidates })
    if (!accepted.names.length) return match

    const previousSpeakers = match.speakers ?? []
    const speakers = accepted.names.slice(0, 8)
    const speakerEnrichment = createSpeakerEnrichment({
      accepted,
      existing: match.raw?.speakerEnrichment,
      includeCompletionCandidates,
      speakers,
      year,
    })
    const speakersChanged = JSON.stringify(previousSpeakers) !== JSON.stringify(speakers)
    const metadataChanged = shouldUpdateSpeakerEnrichment(
      match.raw?.speakerEnrichment,
      speakerEnrichment,
    )
    const groupsChanged = JSON.stringify(match.speakerGroups ?? []) !== JSON.stringify(accepted.groups)
    if (!speakersChanged && !metadataChanged && !groupsChanged) return match

    if (speakersChanged) {
      mergedMatchCount += 1
      mergedSpeakerCount += Math.max(0, speakers.length - previousSpeakers.length)
    }
    return {
      ...match,
      speakers,
      speakerGroups: accepted.groups,
      raw: {
        ...(match.raw ?? {}),
        speakerEnrichment,
      },
    }
  })

  assertPrivateStateUnchanged(privateStateBefore, privateStateSnapshot(mergedMatches))
  await writeJson(MATCHES_PATH, mergedMatches)
  await refreshSpeakerReports(mergedMatches)
  return {
    mergedMatchCount,
    mergedSpeakerCount,
  }
}

function collectAcceptedSpeakers(record, {
  includeCompletionCandidates = false,
} = {}) {
  const expandedTeamsByName = new Map(
    (record.expandedTeams ?? []).map((team) => [team.team, team]),
  )
  let directCount = 0
  let expandedCount = 0
  const groups = []

  for (const [teamIndex, team] of (record.teams ?? []).entries()) {
    const directSpeakers = (team.speakers ?? [])
      .filter(shouldMergeRosterMatchedSpeaker)
      .sort(compareSpeakerConfidence)
    const expandedTeam = expandedTeamsByName.get(team.team)
    const completionSpeakers = (expandedTeam?.completionCandidates ?? [])
      .filter(shouldMergeCompletionCandidate)
      .sort(compareSpeakerConfidence)
    const selectedDirectSpeakers = dedupeSpeakers(directSpeakers).slice(0, MAX_SPEAKERS_PER_TEAM)
    const remainingSlots = Math.max(0, MAX_SPEAKERS_PER_TEAM - selectedDirectSpeakers.length)
    const selectedCompletionSpeakers = includeCompletionCandidates
      ? dedupeSpeakers(completionSpeakers)
        .filter((speaker) => !selectedDirectSpeakers.some((selected) => selected.name === speaker.name))
        .slice(0, remainingSlots)
      : []
    const selectedSpeakers = [...selectedDirectSpeakers, ...selectedCompletionSpeakers]
    const selectedNames = selectedSpeakers.map((speaker) => speaker.name).filter(Boolean)

    groups.push({
      side: teamIndex === 0 ? '正方' : '反方',
      team: team.team,
      speakers: selectedNames,
    })
    directCount += selectedDirectSpeakers.length
    expandedCount += selectedCompletionSpeakers.length
  }

  return {
    directCount,
    expandedCount,
    groups,
    names: groups.flatMap((group) => group.speakers),
  }
}

function createSpeakerEnrichment({
  accepted,
  existing,
  includeCompletionCandidates,
  speakers,
  year,
}) {
  return {
    ...(existing ?? {}),
    complete: speakers.length >= 8,
    matchedSpeakerCount: accepted.names.length,
    directMergedSpeakerCount: accepted.directCount,
    expandedMergedSpeakerCount: accepted.expandedCount,
    speakerGroups: accepted.groups,
    source: includeCompletionCandidates
      ? 'openingAudioRosterSecondPassWithExpandedCompletion'
      : 'openingAudioRosterSecondPass',
    sourceYear: year,
    acceptedRules: [
      'roster-constrained transcript matches',
      'manualVerification',
      ...(includeCompletionCandidates ? ['tightRosterCompletion up to 4 speakers per team'] : []),
    ],
    updatedAt: new Date().toISOString(),
  }
}

function shouldUpdateSpeakerEnrichment(existing = {}, next = {}) {
  return existing.complete !== next.complete
    || existing.matchedSpeakerCount !== next.matchedSpeakerCount
    || existing.directMergedSpeakerCount !== next.directMergedSpeakerCount
    || existing.expandedMergedSpeakerCount !== next.expandedMergedSpeakerCount
    || existing.source !== next.source
    || existing.sourceYear !== next.sourceYear
    || JSON.stringify(existing.speakerGroups ?? []) !== JSON.stringify(next.speakerGroups ?? [])
    || JSON.stringify(existing.acceptedRules ?? []) !== JSON.stringify(next.acceptedRules ?? [])
}

function shouldMergeRosterMatchedSpeaker(speaker) {
  return Boolean(speaker?.name)
    && (speaker.autoMerge === true || speaker.sourcePass === 'manualVerification')
}

function compareSpeakerConfidence(left, right) {
  return speakerRank(right) - speakerRank(left)
}

function speakerRank(speaker) {
  return manualVerificationBonus(speaker)
    + autoMergeBonus(speaker)
    + Number(speaker.confidence ?? 0)
}

function manualVerificationBonus(speaker) {
  return speaker.sourcePass === 'manualVerification' || speaker.confidenceLevel === 'verified'
    ? 3
    : 0
}

function autoMergeBonus(speaker) {
  return speaker.autoMerge === true ? 1 : 0
}

function dedupeSpeakers(speakers) {
  const speakerByName = new Map()
  for (const speaker of speakers) {
    if (!speaker?.name) continue
    if (!speakerByName.has(speaker.name)) speakerByName.set(speaker.name, speaker)
  }
  return [...speakerByName.values()]
}

function shouldMergeCompletionCandidate(speaker) {
  return speaker.sourcePass === 'tightRosterCompletion'
    || String(speaker.matchMethod ?? '').startsWith('tight-roster-pool-')
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function runCli() {
  const argv = process.argv.slice(2)
  const year = parseYear(argv)
  const includeCompletionCandidates = argv.includes('--include-completion-candidates')
  const result = await mergeRosterSecondPassResults({ includeCompletionCandidates, year })
  console.log(
    `[speakers:roster:${year}:merge-second-pass] `
    + `已合并 ${result.mergedMatchCount} 场，新增 ${result.mergedSpeakerCount} 名辩手。`,
  )
  if (!includeCompletionCandidates) {
    console.log(
      `[speakers:roster:${year}:merge-second-pass] `
      + '扩展候补未合并；只合并转写文本与名单约束直接匹配的人名。',
    )
  }
}

function parseYear(argv) {
  const yearIndex = argv.indexOf('--year')
  if (yearIndex < 0) return 2024
  const year = Number(argv[yearIndex + 1])
  return Number.isFinite(year) ? year : 2024
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(`[speakers:roster:merge-second-pass] ${error?.message ?? error}`)
    process.exitCode = 1
  })
}
