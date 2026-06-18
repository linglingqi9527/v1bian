import { createId } from '../utils/ids.js'
import { DEMO_USER_ID } from './userModel.js'

export function createReviewModel(review = {}) {
  return {
    id: review.id ?? createId('review'),
    userId: review.userId ?? DEMO_USER_ID,
    matchId: review.matchId ?? '',
    title: review.title ?? '',
    content: review.content ?? '',
    createdAt: review.createdAt ?? new Date().toISOString(),
    updatedAt: review.updatedAt ?? new Date().toISOString(),
  }
}
