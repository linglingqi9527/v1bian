export function isMatchWatched(match) {
  return match.status === '已看'
}

export function getMatchReviewRoute(matchId) {
  return `/reviews/match/${matchId}/edit`
}
