import { getReviewByMatchId } from '../features/reviews/reviewService.js'

export function useMatchReview(matchId) {
  return getReviewByMatchId(matchId)
}
