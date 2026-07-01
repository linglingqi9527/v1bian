import { createId } from '../utils/ids.js'
import { DEMO_USER_ID } from './userModel.js'

export function createReviewModel(review = {}) {
  return {
    id: review.id ?? createId('review'),
    userId: review.userId ?? DEMO_USER_ID,
    matchId: review.matchId ?? '',
    title: review.title ?? '',
    content: review.content ?? '',
    matchSnapshot: createReviewMatchSnapshot(review.matchSnapshot),
    priority: normalizeReviewPriority(review.priority),
    status: review.status ?? '草稿',
    manualSavedAt: review.manualSavedAt ?? '',
    createdAt: review.createdAt ?? new Date().toISOString(),
    updatedAt: review.updatedAt ?? new Date().toISOString(),
  }
}

function createReviewMatchSnapshot(snapshot = {}) {
  return {
    event: snapshot?.event ?? '',
    teams: snapshot?.teams ?? '',
    topic: snapshot?.topic ?? '',
    year: snapshot?.year ?? '',
  }
}

function normalizeReviewPriority(priority) {
  return ['red', 'black', 'purple', 'yellow'].includes(priority) ? priority : 'yellow'
}
