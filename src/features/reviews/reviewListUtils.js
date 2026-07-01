import { getMatchById } from '../matches/matchService.js'
import { formatMatchTeams } from '../matches/matchUtils.js'
import { listTrainingsByReviewId } from '../trainings/trainingService.js'
import { listReviews } from './reviewService.js'
import { REVIEW_STATUS, formatReviewMatchInfo } from './reviewUtils.js'

export function createReviewItems() {
  return listReviews()
    .map((review) => {
      const match = getMatchById(review.matchId)
      const matchInfo = formatReviewMatchInfo(match, formatMatchTeams)
      const snapshot = review.matchSnapshot ?? {}
      const trainingCount = listTrainingsByReviewId(review.id).length

      return {
        id: review.id,
        meta: [
          snapshot.teams || matchInfo.teams,
          snapshot.event || matchInfo.event,
        ].filter(Boolean).join(' · '),
        searchText: normalizeSearchText([
          review.title,
          review.status,
          snapshot.topic,
          snapshot.teams,
          snapshot.event,
          snapshot.year,
          matchInfo.title,
          matchInfo.teams,
          matchInfo.event,
          matchInfo.year,
        ].filter(Boolean).join(' ')),
        status: review.status,
        title: review.title || '未命名赛评',
        priority: review.priority,
        trainingCount,
        updatedAt: review.updatedAt,
        updatedLabel: `最后编辑：${formatReviewTime(review.updatedAt)}`,
        year: snapshot.year || matchInfo.year,
      }
    })
    .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime())
}

export function filterReviewItems(items, activeTab, activePriority, searchQuery) {
  const keyword = normalizeSearchText(searchQuery)

  return items.filter((item) => {
    if (activeTab === '已完成' && item.status !== REVIEW_STATUS.completed) return false
    if (activeTab === '草稿箱' && item.status !== REVIEW_STATUS.draft) return false
    if (activeTab === '已训练' && item.trainingCount === 0) return false
    if (activePriority !== 'all' && item.priority !== activePriority) return false
    if (keyword && !item.searchText.includes(keyword)) return false
    return true
  })
}

function formatReviewTime(value) {
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
