export function isMatchWatched(match) {
  return Boolean(match?.watched)
}

export function isMatchReviewed(match) {
  return Boolean(match?.reviewId)
}

export function getMatchTrainingCount(match) {
  return Array.isArray(match?.trainingIds) ? match.trainingIds.length : 0
}

export function getMatchStatusTags(match) {
  const trainingCount = getMatchTrainingCount(match)

  return [
    {
      active: isMatchWatched(match),
      kind: 'watched',
      label: isMatchWatched(match) ? '已看' : '未看',
      tone: isMatchWatched(match) ? 'yellow' : 'gray',
    },
    {
      active: isMatchReviewed(match),
      kind: 'review',
      label: isMatchReviewed(match) ? '已评' : '待评',
      tone: isMatchReviewed(match) ? 'blue' : 'gray',
    },
    {
      active: trainingCount > 0,
      kind: 'training',
      label: `已练 ${trainingCount}`,
      tone: trainingCount > 0 ? 'green' : 'gray',
    },
  ]
}

export function formatMatchTeams(match) {
  return Array.isArray(match?.teams) ? match.teams.join(' vs ') : ''
}

export function formatMatchSpeakers(match) {
  return Array.isArray(match?.speakers) ? match.speakers.join(' ') : ''
}

export function getMatchReviewRoute(match) {
  if (typeof match === 'string') return `/reviews/match/${match}/edit`
  if (!match?.id) return '/reviews'

  return match.reviewId
    ? `/reviews/${match.reviewId}/edit?matchId=${match.id}`
    : `/reviews/match/${match.id}/edit`
}

export function getMatchTrainingRoute(match) {
  if (!match?.id) return '/trainings/new'

  const params = new URLSearchParams({ matchId: match.id })
  if (match.reviewId) params.set('reviewId', match.reviewId)

  return `/trainings/new?${params.toString()}`
}

export function filterMatches(matches, activeFilter) {
  if (activeFilter === '已看') return matches.filter((match) => match.watched)
  if (activeFilter === '收藏') return matches.filter((match) => match.favorite)
  return matches
}

export function searchMatches(matches, query) {
  const keyword = normalizeSearchText(query)
  if (!keyword) return matches

  return matches.filter((match) => createMatchSearchText(match).includes(keyword))
}

function createMatchSearchText(match) {
  return normalizeSearchText([
    match.title,
    match.event,
    match.stage,
    match.date,
    match.bvId,
    ...(Array.isArray(match.teams) ? match.teams : []),
    ...(Array.isArray(match.speakers) ? match.speakers : []),
  ].filter(Boolean).join(' '))
}

function normalizeSearchText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}
