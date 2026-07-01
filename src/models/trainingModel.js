import { createId } from '../utils/ids.js'
import { DEMO_USER_ID } from './userModel.js'

export function createTrainingModel(training = {}) {
  return {
    id: training.id ?? createId('training'),
    userId: training.userId ?? DEMO_USER_ID,
    matchId: training.matchId ?? '',
    reviewId: training.reviewId ?? '',
    title: training.title ?? '',
    mode: training.mode ?? 'audio',
    note: training.note ?? '',
    priority: normalizeTrainingPriority(training.priority),
    durationMs: training.durationMs ?? 0,
    mediaId: training.mediaId ?? '',
    mediaType: training.mediaType ?? '',
    mediaUrl: training.mediaUrl ?? '',
    createdAt: training.createdAt ?? new Date().toISOString(),
  }
}

function normalizeTrainingPriority(priority) {
  return ['red', 'black', 'purple', 'yellow'].includes(priority) ? priority : 'yellow'
}
