import { getMatchById } from '../matches/matchService.js'
import { formatMatchTeams } from '../matches/matchUtils.js'
import { getReviewById } from '../reviews/reviewService.js'
import { formatReviewMatchInfo } from '../reviews/reviewUtils.js'
import { listTrainings } from './trainingService.js'

export const TRAINING_TABS = ['全部', '录音', '录像']

export function createTrainingItems() {
  return listTrainings()
    .map((training) => {
      const review = getReviewById(training.reviewId)
      const match = getMatchById(training.matchId || review?.matchId)
      const matchInfo = formatReviewMatchInfo(match, formatMatchTeams)
      const snapshot = review?.matchSnapshot ?? {}
      const modeLabel = getTrainingModeLabel(training.mode)

      return {
        id: training.id,
        createdAt: training.createdAt,
        dateLabel: formatTrainingDate(training.createdAt),
        mode: training.mode,
        modeLabel,
        note: training.note || '还没有训练备注',
        priority: training.priority,
        reviewId: training.reviewId,
        searchText: normalizeSearchText([
          training.title,
          training.note,
          modeLabel,
          snapshot.topic,
          snapshot.teams,
          snapshot.event,
          matchInfo.title,
          matchInfo.teams,
          matchInfo.event,
          matchInfo.year,
        ].filter(Boolean).join(' ')),
        title: training.title || snapshot.topic || matchInfo.title || '未命名训练',
        meta: [
          snapshot.teams || matchInfo.teams,
          snapshot.event || matchInfo.event,
        ].filter(Boolean).join(' · '),
        year: snapshot.year || matchInfo.year,
      }
    })
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
}

export function filterTrainingItems(items, activeTab, activePriority, searchQuery) {
  const keyword = normalizeSearchText(searchQuery)

  return items.filter((item) => {
    if (activeTab === '录音' && item.mode !== 'audio') return false
    if (activeTab === '录像' && item.mode !== 'video') return false
    if (activePriority !== 'all' && item.priority !== activePriority) return false
    if (keyword && !item.searchText.includes(keyword)) return false
    return true
  })
}

function getTrainingModeLabel(mode) {
  return mode === 'video' ? '录像' : '录音'
}

function formatTrainingDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知时间'

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  })
}

function normalizeSearchText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}
