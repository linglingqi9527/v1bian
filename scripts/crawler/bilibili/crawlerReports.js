export function createCrawlerReports({
  candidateVideos,
  matches,
  normalizedMatches,
  rawVideos,
  scopeExclusions = {},
}) {
  const statusByMatchId = new Map(matches.map((match) => [match.id, getSpeakerStatus(match)]))
  const warningCounts = countWarnings(matches)
  const speakerStatusCounts = countValues([...statusByMatchId.values()])
  const rawBvids = rawVideos.map((video) => video.bvid).filter(Boolean)
  const matchBvids = matches.map((match) => match.bvId).filter(Boolean)

  const dataReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    totalVideoCount: rawVideos.length,
    expandedCandidateCount: candidateVideos.length,
    generatedMatchCount: matches.length,
    withBilibiliUrlCount: countMatches(matches, (match) => Boolean(match.bilibiliUrl)),
    withTitleCount: countMatches(matches, (match) => Boolean(match.title)),
    withBvIdCount: countMatches(matches, (match) => Boolean(match.bvId)),
    withTeamsCount: countMatches(matches, (match) => Array.isArray(match.teams) && match.teams.length > 0),
    withSpeakersCount: countMatches(matches, (match) => Array.isArray(match.speakers) && match.speakers.length > 0),
    speakerStatusCounts: {
      missing: speakerStatusCounts.missing ?? 0,
      partial: speakerStatusCounts.partial ?? 0,
      parsed: speakerStatusCounts.parsed ?? 0,
    },
    duplicateBvCount: duplicateEntryCount(rawBvids),
    matchesSharingBvIdCount: duplicateEntryCount(matchBvids),
    deduplicatedMatchCount: Math.max(0, normalizedMatches.length - matches.length),
    filteredVideoCount: Math.max(0, candidateVideos.length - normalizedMatches.length),
    scopeExclusions: {
      middleSchoolMatchCandidateCount: scopeExclusions.middleSchoolMatchCandidateCount ?? 0,
      middleSchoolSourceVideoCount: scopeExclusions.middleSchoolSourceVideoCount ?? 0,
    },
    parseWarnings: {
      totalCount: Object.values(warningCounts).reduce((total, count) => total + count, 0),
      matchCount: countMatches(matches, (match) => (match.raw?.parseWarnings?.length ?? 0) > 0),
      byMessage: warningCounts,
    },
    speakerStatusRules: {
      missing: '没有解析到任何明确辩手姓名。',
      partial: '解析到部分姓名，但团队赛不足 8 人，或全场仅解析到 1 人。',
      parsed: '个人赛/表演赛解析到至少 2 人，或团队赛解析到至少 8 人。',
    },
    fieldReliability: {
      bilibiliUrl: 'high',
      bvId: 'high',
      date: 'high',
      event: 'medium',
      speakers: 'status-dependent',
      stage: 'medium',
      teams: 'medium',
      title: 'high',
    },
  }

  const missingSpeakerReport = matches
    .filter((match) => statusByMatchId.get(match.id) !== 'parsed')
    .map((match) => ({
      bvId: match.bvId,
      title: match.title,
      bilibiliUrl: match.bilibiliUrl,
      event: match.event,
      stage: match.stage,
      date: match.date,
      teams: match.teams,
      speakerStatus: statusByMatchId.get(match.id),
      parseWarnings: match.raw?.parseWarnings ?? [],
    }))

  return { dataReport, missingSpeakerReport }
}

export function getSpeakerStatus(match) {
  const count = Array.isArray(match?.speakers) ? match.speakers.length : 0
  if (count === 0) return 'missing'
  if (count === 1) return 'partial'
  if (isTeamDebate(match) && count < 8) return 'partial'
  return 'parsed'
}

function isTeamDebate(match) {
  if (/团队赛|4V4/i.test(match.stage ?? '')) return true
  return Array.isArray(match.teams)
    && match.teams.some((team) => /(大学|学院|中学|学校|书院|代表队|辩论队)$/.test(team))
}

function countMatches(matches, predicate) {
  return matches.reduce((count, match) => count + Number(predicate(match)), 0)
}

function countValues(values) {
  const counts = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

function countWarnings(matches) {
  const counts = {}
  for (const warning of matches.flatMap((match) => match.raw?.parseWarnings ?? [])) {
    counts[warning] = (counts[warning] ?? 0) + 1
  }
  return counts
}

function duplicateEntryCount(values) {
  return values.length - new Set(values).size
}
