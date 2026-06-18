export function buildReviewTitle(matchTitle) {
  return `${matchTitle} 赛评`
}

export function hasReviewForMatch(reviews, matchId) {
  return reviews.some((review) => review.matchId === matchId)
}
