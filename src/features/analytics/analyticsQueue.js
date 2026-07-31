const QUEUE_STORAGE_KEY = 'bianleme.analytics.queue.v1'
const MAX_QUEUE_SIZE = 40
const QUEUE_TTL_MS = 1000 * 60 * 60 * 24 * 3
const FORBIDDEN_PROPERTY_NAMES = new Set([
  'accessToken', 'audioBlob', 'blob', 'content', 'contentHtml', 'directoryName', 'email',
  'filePath', 'localPath', 'mediaPath', 'note', 'password', 'passwordHash', 'phone',
  'realName', 'refreshToken', 'reviewBody', 'transcript', 'username', 'videoBlob',
])

export function enqueueAnalyticsEvent(event) {
  if (!isQueueableEvent(event)) return

  const queue = readQueue()
  const nextQueue = [...queue, { event, queuedAt: Date.now() }]
    .filter(isQueueItemFresh)
    .slice(-MAX_QUEUE_SIZE)

  writeQueue(nextQueue)
}

export async function flushAnalyticsQueue(sendEvent) {
  const queue = readQueue()
  if (queue.length === 0) return

  const remaining = []
  for (const item of queue) {
    if (!isQueueItemFresh(item)) continue

    try {
      const result = await sendEvent(item.event)
      if (!result?.delivered && result?.retryable) remaining.push(item)
    } catch {
      remaining.push(item)
    }
  }

  writeQueue(remaining.slice(-MAX_QUEUE_SIZE))
}

function readQueue() {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY)
    const queue = raw ? JSON.parse(raw) : []
    return Array.isArray(queue) ? queue.filter(isQueueItemFresh) : []
  } catch {
    return []
  }
}

function writeQueue(queue) {
  if (typeof window === 'undefined') return

  try {
    if (queue.length === 0) {
      window.localStorage.removeItem(QUEUE_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // 统计队列不可用时静默降级，不能影响主功能。
  }
}

function isQueueItemFresh(item) {
  return isQueueableEvent(item?.event) && Number.isFinite(item?.queuedAt) && Date.now() - item.queuedAt < QUEUE_TTL_MS
}

function isQueueableEvent(event) {
  return Boolean(event?.eventId) && !containsForbiddenProperty(event)
}

function containsForbiddenProperty(value) {
  if (!value || typeof value !== 'object') return false

  return Object.entries(value).some(([key, nestedValue]) => {
    if (FORBIDDEN_PROPERTY_NAMES.has(key)) return true
    return containsForbiddenProperty(nestedValue)
  })
}
