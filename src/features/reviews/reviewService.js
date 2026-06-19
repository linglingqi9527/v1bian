import { demoReviews } from '../../data/demoReviews.js'
import { createReviewModel } from '../../models/reviewModel.js'
import { DEMO_USER_ID } from '../../models/userModel.js'
import { readLocalDb, writeLocalDb } from '../storage/localDb.js'
import { setMatchReviewId } from '../matches/matchService.js'

export function listReviews() {
  const persistedReviews = readLocalDb()?.reviews
  const reviews = Array.isArray(persistedReviews) ? persistedReviews : demoReviews

  return reviews
    .map((review) => createReviewModel(review))
    .filter((review) => review.userId === DEMO_USER_ID)
}

export function getReviewById(reviewId) {
  return listReviews().find((review) => review.id === reviewId)
}

export function getReviewByMatchId(matchId) {
  return listReviews().find((review) => review.matchId === matchId)
}

export function saveReviews(reviews) {
  const snapshot = readLocalDb() ?? {}
  writeLocalDb({
    ...snapshot,
    reviews: reviews.map((review) => createReviewModel(review)),
  })
}

export function saveReviewForMatch(matchId, reviewDraft = {}) {
  const existingReview = getReviewByMatchId(matchId)
  const now = new Date().toISOString()
  const savedReview = createReviewModel({
    ...existingReview,
    ...reviewDraft,
    id: reviewDraft.id ?? existingReview?.id,
    matchId,
    updatedAt: now,
    createdAt: existingReview?.createdAt ?? reviewDraft.createdAt ?? now,
  })
  const nextReviews = [
    ...listReviews().filter((review) => review.id !== savedReview.id),
    savedReview,
  ]

  saveReviews(nextReviews)
  setMatchReviewId(matchId, savedReview.id)

  return savedReview
}
