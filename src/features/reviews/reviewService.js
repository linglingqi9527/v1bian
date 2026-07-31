import { demoReviews } from '../../data/demoReviews.js'
import { createReviewModel } from '../../models/reviewModel.js'
import { getActiveUserId } from '../auth/authService.js'
import { getCachedLocalLibraryDb, updateActiveLocalLibraryDb } from '../storage/localLibraryService.js'
import { readLocalDb, writeLocalDb } from '../storage/localDb.js'
import { clearMatchReviewId, setMatchReviewId } from '../matches/matchService.js'
import { canWriteUserData, getUserDataAccessState, notifyUserDataBlocked } from '../storage/userDataAccess.js'

export const REVIEWS_UPDATED_EVENT = 'bianleme:reviews-updated'

export function listReviews() {
  const activeUserId = getActiveUserId()
  const accessState = getUserDataAccessState()
  if (!activeUserId) return []

  if (accessState.mode === 'local') {
    return normalizeReviewCollection(getCachedLocalLibraryDb()?.reviews, activeUserId)
  }

  if (accessState.mode !== 'developer') return []

  const persistedReviews = readLocalDb()?.reviews
  const reviews = Array.isArray(persistedReviews) ? persistedReviews : demoReviews

  return normalizeReviewCollection(reviews, activeUserId)
}

export function getReviewById(reviewId) {
  return listReviews().find((review) => review.id === reviewId)
}

export function getReviewByMatchId(matchId) {
  return listReviews().find((review) => review.matchId === matchId)
}

export function saveReviews(reviews) {
  const accessState = getUserDataAccessState()
  if (!canWriteUserData()) {
    notifyUserDataBlocked()
    return
  }
  if (accessState.mode === 'local') {
    const normalizedReviews = reviews.map((review) => createReviewModel(review))
    void updateActiveLocalLibraryDb((libraryDb) => ({
      ...libraryDb,
      reviews: normalizedReviews,
    })).catch(reportLocalLibraryWriteError)
    notifyReviewsUpdated()
    return
  }
  if (accessState.mode !== 'developer') return

  const snapshot = readLocalDb() ?? {}
  writeLocalDb({
    ...snapshot,
    reviews: reviews.map((review) => createReviewModel(review)),
  })
  notifyReviewsUpdated()
}

export function saveReview(reviewDraft = {}) {
  const activeUserId = getActiveUserId()
  const accessState = getUserDataAccessState()
  if (!activeUserId || !canWriteUserData()) {
    notifyUserDataBlocked()
    return null
  }
  if (accessState.mode !== 'developer' && accessState.mode !== 'local') return null

  const existingReview = reviewDraft.id ? getReviewById(reviewDraft.id) : null
  const now = new Date().toISOString()
  const savedReview = createReviewModel({
    ...existingReview,
    ...reviewDraft,
    id: reviewDraft.id ?? existingReview?.id,
    matchId: reviewDraft.matchId ?? existingReview?.matchId ?? '',
    userId: activeUserId,
    updatedAt: now,
    createdAt: existingReview?.createdAt ?? reviewDraft.createdAt ?? now,
  })
  const nextReviews = [
    ...listReviews().filter((review) => review.id !== savedReview.id),
    savedReview,
  ]

  saveReviews(nextReviews)

  return savedReview
}

export function saveReviewForMatch(matchId, reviewDraft = {}) {
  const activeUserId = getActiveUserId()
  const accessState = getUserDataAccessState()
  if (!activeUserId || !canWriteUserData()) {
    notifyUserDataBlocked()
    return null
  }
  if (accessState.mode !== 'developer' && accessState.mode !== 'local') return null

  const existingReview = getReviewByMatchId(matchId)
  const now = new Date().toISOString()
  const savedReview = createReviewModel({
    ...existingReview,
    ...reviewDraft,
    id: reviewDraft.id ?? existingReview?.id,
    matchId,
    userId: activeUserId,
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

export function deleteReview(reviewId) {
  if (!reviewId) return

  if (!canWriteUserData()) {
    notifyUserDataBlocked()
    return
  }

  const removingReview = getReviewById(reviewId)
  saveReviews(listReviews().filter((review) => review.id !== reviewId))

  if (removingReview?.matchId) {
    clearMatchReviewId(removingReview.matchId, reviewId)
  }
}

function normalizeReviewCollection(reviews, activeUserId) {
  return (Array.isArray(reviews) ? reviews : [])
    .map((review) => createReviewModel(review))
    .filter((review) => review.userId === activeUserId)
}

function reportLocalLibraryWriteError(error) {
  console.warn('无法写入本地资料包赛评', error)
}

function notifyReviewsUpdated() {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new Event(REVIEWS_UPDATED_EVENT))
}
