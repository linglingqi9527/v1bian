import { demoReviews } from '../../data/demoReviews.js'
import { DEMO_USER_ID } from '../../models/userModel.js'

export function listReviews() {
  return demoReviews.filter((review) => review.userId === DEMO_USER_ID)
}

export function getReviewById(reviewId) {
  return listReviews().find((review) => review.id === reviewId)
}

export function getReviewByMatchId(matchId) {
  return listReviews().find((review) => review.matchId === matchId)
}
