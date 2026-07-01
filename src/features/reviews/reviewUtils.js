export function buildReviewTitle(matchTitle) {
  return `${matchTitle} 赛评`
}

export function hasReviewForMatch(reviews, matchId) {
  return reviews.some((review) => review.matchId === matchId)
}

export const REVIEW_STATUS = {
  draft: '草稿',
  completed: '已完成',
}

export const REVIEW_PRIORITY = {
  red: 'red',
  black: 'black',
  purple: 'purple',
  yellow: 'yellow',
}

export const REVIEW_PRIORITY_OPTIONS = [
  { label: '最高级', value: REVIEW_PRIORITY.red },
  { label: '第二级', value: REVIEW_PRIORITY.black },
  { label: '第三级', value: REVIEW_PRIORITY.purple },
  { label: '第四级', value: REVIEW_PRIORITY.yellow },
]

export function normalizeReviewStatus(status) {
  return status === REVIEW_STATUS.completed ? REVIEW_STATUS.completed : REVIEW_STATUS.draft
}

export function normalizeReviewPriority(priority) {
  return Object.values(REVIEW_PRIORITY).includes(priority) ? priority : REVIEW_PRIORITY.yellow
}

export function getDefaultReviewTitle(match, fallbackTitle = '未命名赛评') {
  if (fallbackTitle && fallbackTitle !== '未命名赛评') return fallbackTitle
  if (match?.title) return buildReviewTitle(match.title)
  return fallbackTitle
}

export function getReviewEditorInitialState(review, match) {
  return {
    content: normalizeReviewEditorContent(review?.content ?? ''),
    status: normalizeReviewStatus(review?.status),
    title: getDefaultReviewTitle(match, review?.title || '未命名赛评'),
  }
}

export function normalizeReviewEditorContent(content) {
  if (!content) return ''
  if (content.trim().startsWith('<')) return content

  return content
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
    .join('')
}

export function getReviewContentText(content) {
  if (!content) return ''

  return content
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function getMatchYear(match) {
  const source = match?.date || match?.publishedAt || ''
  const year = String(source).match(/\d{4}/)?.[0]
  return year ? `${year} 年` : '年份待补'
}

export function formatReviewMatchInfo(match, formatTeams) {
  if (!match) return {
    event: '未关联比赛',
    teams: '队伍待补',
    title: '我的赛评',
    year: '年份待补',
  }

  return {
    event: match.event || match.stage || '赛事待补',
    teams: formatTeams(match) || '队伍待补',
    title: match.title || '未命名比赛',
    year: getMatchYear(match),
  }
}

export function getReviewMatchSnapshot(review, matchInfo) {
  const snapshot = review?.matchSnapshot ?? {}

  return {
    event: snapshot.event || matchInfo.event || '',
    teams: snapshot.teams || matchInfo.teams || '',
    topic: snapshot.topic || matchInfo.title || '',
    year: snapshot.year || matchInfo.year || '',
  }
}

export function validateReviewSave({ contentText, status, title }) {
  if (status !== REVIEW_STATUS.completed) return []

  const errors = []
  if (!title?.trim()) errors.push('标题为空时不能保存为已完成。')
  if (!contentText?.trim()) errors.push('正文为空时不能保存为已完成。')
  return errors
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
