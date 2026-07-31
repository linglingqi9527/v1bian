import { getMatchById, listMatches } from '../matches/matchService.js'
import { listReviews } from '../reviews/reviewService.js'
import { listTrainings } from '../trainings/trainingService.js'

const MAX_MY_MATCHES = 2
const MAX_CURRENT_ITEMS = 2

export function getSideNavActivity() {
  const reviews = listReviews()
  const trainings = listTrainings()
  const matches = listMatches()

  return {
    currentItems: createCurrentItems(reviews, trainings),
    myMatches: createMyMatches(matches, reviews),
  }
}

function createMyMatches(matches, reviews) {
  const reviewedAtByMatchId = new Map(
    reviews
      .filter((review) => review.matchId)
      .map((review) => [review.matchId, review.updatedAt]),
  )

  return matches
    .filter((match) => match.watched || reviewedAtByMatchId.has(match.id))
    .map((match) => ({
      id: match.id,
      meta: createMatchActivityMeta(match, reviewedAtByMatchId.get(match.id)),
      sortAt: latestDate(match.watchedAt, reviewedAtByMatchId.get(match.id), match.publishedAt),
      title: match.title || '未命名比赛',
      to: `/matches/${match.id}`,
    }))
    .sort((first, second) => second.sortAt - first.sortAt)
    .slice(0, MAX_MY_MATCHES)
}

function createCurrentItems(reviews, trainings) {
  const reviewItems = reviews.map((review) => {
    const match = getMatchById(review.matchId)
    const statusLabel = review.status === '已完成' ? '已完成' : '草稿'

    return {
      id: `review-${review.id}`,
      meta: `赛评 · ${statusLabel}`,
      sortAt: latestDate(review.updatedAt, review.createdAt),
      title: match?.title || review.title || '未命名赛评',
      to: `/reviews/${review.id}/edit`,
    }
  })
  const trainingItems = trainings.map((training) => {
    const match = getMatchById(training.matchId)
    const mediaCount = Array.isArray(training.mediaItems) ? training.mediaItems.length : 0

    return {
      id: `training-${training.id}`,
      meta: mediaCount > 0 ? `训练 · ${mediaCount} 条素材` : '训练 · 尚未添加素材',
      sortAt: latestDate(training.updatedAt, training.createdAt),
      title: match?.title || training.title || '未命名训练',
      to: `/trainings/${training.id}`,
    }
  })

  return [...reviewItems, ...trainingItems]
    .sort((first, second) => second.sortAt - first.sortAt)
    .slice(0, MAX_CURRENT_ITEMS)
}

function createMatchActivityMeta(match, reviewedAt) {
  if (reviewedAt && match.watchedAt) {
    return latestDate(reviewedAt) >= latestDate(match.watchedAt) ? '已写赛评' : '最近观看'
  }

  return reviewedAt ? '已写赛评' : '最近观看'
}

function latestDate(...values) {
  return values.reduce((latest, value) => {
    const time = new Date(value ?? '').getTime()
    return Number.isNaN(time) ? latest : Math.max(latest, time)
  }, 0)
}
