import { createId } from '../utils/ids.js'
import { DEMO_USER_ID } from './userModel.js'

export function createMatchModel(match = {}) {
  return {
    id: match.id ?? createId('match'),
    userId: match.userId ?? DEMO_USER_ID,
    title: match.title ?? '',
    topic: match.topic ?? '',
    summary: match.summary ?? '',
    status: match.status ?? '未看',
    sourceUrl: match.sourceUrl ?? '',
    publishedAt: match.publishedAt ?? new Date().toISOString(),
  }
}
