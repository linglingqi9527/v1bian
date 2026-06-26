import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getSpeakerStatus } from '../crawlerReports.js'
import { GENERATED_DIR } from './selectSpeakerTargets.js'

const MATCHES_PATH = path.join(GENERATED_DIR, 'generatedMatches.json')
const DATA_REPORT_PATH = path.join(GENERATED_DIR, 'crawlerDataReport.json')
const MISSING_REPORT_PATH = path.join(GENERATED_DIR, 'missingSpeakerReport.json')

export async function mergeRosterSpeakerResults(records, {
  acceptLowConfidence = false,
} = {}) {
  const matches = JSON.parse(await readFile(MATCHES_PATH, 'utf8'))
  const privateStateBefore = privateStateSnapshot(matches)
  const recordById = new Map(records.map((record) => [record.matchId, record]))
  let mergedMatchCount = 0
  let mergedSpeakerCount = 0

  const mergedMatches = matches.map((match) => {
    const record = recordById.get(match.id)
    if (!record) return match
    const recognizedNames = record.teams.flatMap((team) => (
      team.speakers
        .filter((speaker) => acceptLowConfidence || speaker.autoMerge !== false)
        .map((speaker) => speaker.name)
    ))
    if (recognizedNames.length === 0) return match

    const speakers = [...new Set([...(match.speakers ?? []), ...recognizedNames])]
    mergedMatchCount += 1
    mergedSpeakerCount += speakers.length - (match.speakers?.length ?? 0)
    return {
      ...match,
      speakers,
      raw: {
        ...(match.raw ?? {}),
        speakerEnrichment: {
          complete: speakers.length >= 8,
          acceptedLowConfidence: acceptLowConfidence,
          matchedSpeakerCount: recognizedNames.length,
          source: acceptLowConfidence
            ? 'openingAudioRosterMatchAcceptedCandidates'
            : 'openingAudioRosterMatch',
          updatedAt: new Date().toISOString(),
        },
      },
    }
  })

  assertPrivateStateUnchanged(privateStateBefore, privateStateSnapshot(mergedMatches))
  await writeJson(MATCHES_PATH, mergedMatches)
  await refreshSpeakerReports(mergedMatches)
  return { mergedMatchCount, mergedSpeakerCount }
}

async function refreshSpeakerReports(matches) {
  const statusCounts = { missing: 0, parsed: 0, partial: 0 }
  for (const match of matches) statusCounts[getSpeakerStatus(match)] += 1

  const dataReport = await readOptionalJson(DATA_REPORT_PATH)
  if (dataReport) {
    await writeJson(DATA_REPORT_PATH, {
      ...dataReport,
      speakerDataUpdatedAt: new Date().toISOString(),
      speakerStatusCounts: statusCounts,
      withSpeakersCount: matches.filter((match) => match.speakers?.length > 0).length,
    })
  }

  const missingSpeakerReport = matches
    .filter((match) => getSpeakerStatus(match) !== 'parsed')
    .map((match) => ({
      bvId: match.bvId,
      title: match.title,
      bilibiliUrl: match.bilibiliUrl,
      event: match.event,
      stage: match.stage,
      date: match.date,
      teams: match.teams,
      speakers: match.speakers,
      speakerStatus: getSpeakerStatus(match),
      parseWarnings: match.raw?.parseWarnings ?? [],
    }))
  await writeJson(MISSING_REPORT_PATH, missingSpeakerReport)
}

function privateStateSnapshot(matches) {
  return JSON.stringify(matches.map((match) => ({
    id: match.id,
    favorite: match.favorite,
    reviewId: match.reviewId,
    trainingIds: match.trainingIds,
    watched: match.watched,
  })))
}

function assertPrivateStateUnchanged(before, after) {
  if (before !== after) throw new Error('合并辩手姓名时检测到私人状态字段变化，已停止写入。')
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    return null
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}
