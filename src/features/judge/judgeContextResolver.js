import { getMatchById, listMatches } from '../matches/matchService.js'
import { getReviewById, getReviewByMatchId, listReviews } from '../reviews/reviewService.js'
import { getTrainingById, listTrainings } from '../trainings/trainingService.js'

export const JUDGE_CONTEXT_TYPES = {
  match: 'match',
  review: 'review',
  training: 'training',
}

export function resolveJudgeContext(contextDraft = {}) {
  const type = contextDraft.type ?? contextDraft.contextType ?? JUDGE_CONTEXT_TYPES.match
  const training = contextDraft.trainingId ? getTrainingById(contextDraft.trainingId) : getDefaultTraining()
  const review = contextDraft.reviewId
    ? getReviewById(contextDraft.reviewId)
    : contextDraft.matchId
      ? getReviewByMatchId(contextDraft.matchId)
      : getDefaultReview()
  const matchId = contextDraft.matchId || training?.matchId || review?.matchId || getDefaultMatch()?.id || ''
  const match = matchId ? getMatchById(matchId) : getDefaultMatch()
  const resolvedReview = review ?? (match?.id ? getReviewByMatchId(match.id) : null)
  const resolvedTraining = training ?? getDefaultTraining()
  const contextType = normalizeContextType(type, {
    review: resolvedReview,
    training: resolvedTraining,
  })

  return {
    type: contextType,
    match,
    review: resolvedReview,
    training: resolvedTraining,
    matchId: match?.id ?? '',
    reviewId: resolvedReview?.id ?? '',
    trainingId: resolvedTraining?.id ?? '',
    sourceLabel: createSourceLabel(contextType, match, resolvedReview, resolvedTraining),
    title: createContextTitle(contextType, match, resolvedReview, resolvedTraining),
    availableMaterials: createAvailableMaterials(match, resolvedReview, resolvedTraining),
  }
}

export function createConversationDraftFromContext(context) {
  return {
    title: context.title,
    contextType: context.type,
    matchId: context.matchId,
    reviewId: context.reviewId,
    trainingId: context.trainingId,
    sourceLabel: context.sourceLabel,
  }
}

function normalizeContextType(type, resolved) {
  if (type === JUDGE_CONTEXT_TYPES.training && resolved.training) return JUDGE_CONTEXT_TYPES.training
  if (type === JUDGE_CONTEXT_TYPES.review && resolved.review) return JUDGE_CONTEXT_TYPES.review
  return Object.values(JUDGE_CONTEXT_TYPES).includes(type) ? type : JUDGE_CONTEXT_TYPES.match
}

function createSourceLabel(type, match, review, training) {
  if (type === JUDGE_CONTEXT_TYPES.training && training) return `训练 · ${training.title}`
  if (type === JUDGE_CONTEXT_TYPES.review && review) return `赛评 · ${review.title}`
  if (match) return `比赛 · ${match.topic}`
  return '未绑定上下文'
}

function createContextTitle(type, match, review, training) {
  if (type === JUDGE_CONTEXT_TYPES.training && training) return `Judge · ${training.title}`
  if (type === JUDGE_CONTEXT_TYPES.review && review) return `Judge · ${review.title}`
  if (match) return `Judge · ${match.topic}`
  return 'Judge · 临时会话'
}

function createAvailableMaterials(match, review, training) {
  return [
    match ? { id: 'match', label: '比赛资料', state: '已接入' } : null,
    match?.videoUrl ? { id: 'video', label: '比赛 URL', state: '可读取' } : null,
    review ? { id: 'review', label: '赛评草稿', state: '已接入' } : null,
    training ? { id: 'training', label: '训练记录', state: '已接入' } : null,
    training?.mediaId || training?.mediaPath ? { id: 'media', label: '训练素材', state: '待转写' } : null,
  ].filter(Boolean)
}

function getDefaultMatch() {
  return listMatches()[0] ?? null
}

function getDefaultReview() {
  return listReviews()[0] ?? null
}

function getDefaultTraining() {
  return listTrainings()[0] ?? null
}
