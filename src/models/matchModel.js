import { createId } from '../utils/ids.js'
import { DEMO_USER_ID } from './userModel.js'

export function createMatchModel(match = {}) {
  const teams = Array.isArray(match.teams) ? match.teams : []
  const speakers = Array.isArray(match.speakers) ? match.speakers : []
  const trainingIds = Array.isArray(match.trainingIds) ? match.trainingIds : []

  return {
    id: match.id ?? createId('match'),
    userId: match.userId ?? DEMO_USER_ID,
    title: match.title ?? '',
    topic: match.topic ?? match.title ?? '',
    event: match.event ?? '',
    stage: match.stage ?? '',
    date: match.date ?? '',
    bvId: match.bvId ?? '',
    bilibiliUrl: match.bilibiliUrl ?? match.sourceUrl ?? '',
    teams,
    speakers,
    favorite: Boolean(match.favorite),
    watched: Boolean(match.watched ?? match.status === '已看'),
    reviewId: match.reviewId ?? null,
    trainingIds,
    accent: match.accent ?? 'yellow',
    summary: match.summary ?? '',
    status: match.status ?? (match.watched ? '已看' : '未看'),
    sourceUrl: match.sourceUrl ?? match.bilibiliUrl ?? '',
    publishedAt: match.publishedAt ?? new Date().toISOString(),
    duration: match.duration ?? 0,
    raw: match.raw ?? null,
  }
}
