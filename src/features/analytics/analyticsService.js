import { getAnalyticsConfig } from './analyticsConfig.js'
import { ANALYTICS_EVENTS, getAnalyticsEventDefinition } from './analyticsEvents.js'
import { getAnalyticsIdentity, getAnalyticsSessionId } from './analyticsIdentity.js'
import { enqueueAnalyticsEvent, flushAnalyticsQueue } from './analyticsQueue.js'
import { createAnalyticsEvent } from './analyticsSchema.js'
import { sanitizeAnalyticsProperties } from './analyticsSanitizer.js'
import { createCloudbaseAnalyticsProvider } from './providers/cloudbaseAnalyticsProvider.js'
import { noopAnalyticsProvider } from './providers/noopAnalyticsProvider.js'

let hasInitialized = false
let isFlushingQueue = false

export function track(eventName, properties = {}) {
  try {
    const definition = getAnalyticsEventDefinition(eventName)
    const config = getAnalyticsConfig()
    if (!definition || !config.enabled) return null

    const event = createAnalyticsEvent({
      appVersion: config.appVersion,
      category: definition.category,
      eventId: createEventId(),
      eventName,
      identity: getAnalyticsIdentity(),
      properties: sanitizeAnalyticsProperties(eventName, properties),
      sessionId: getAnalyticsSessionId(),
    })

    void sendAnalyticsEvent(event, config)
    return event.eventId
  } catch {
    return null
  }
}

export function initializeAnalytics() {
  if (hasInitialized || typeof window === 'undefined') return
  hasInitialized = true

  const config = getAnalyticsConfig()
  if (!config.enabled) return

  void flushPendingAnalyticsEvents(config)
  trackAppErrors()
  window.addEventListener('online', () => {
    const nextConfig = getAnalyticsConfig()
    if (nextConfig.enabled) void flushPendingAnalyticsEvents(nextConfig)
  })
  track(ANALYTICS_EVENTS.APP_OPEN)
}

async function sendAnalyticsEvent(event, config) {
  try {
    const result = await getAnalyticsProvider(config).send(event)
    if (!result.delivered && result.retryable) enqueueAnalyticsEvent(event)
  } catch {
    enqueueAnalyticsEvent(event)
  }
}

async function flushPendingAnalyticsEvents(config) {
  if (isFlushingQueue) return
  isFlushingQueue = true

  try {
    const provider = getAnalyticsProvider(config)
    await flushAnalyticsQueue((event) => provider.send(event))
  } finally {
    isFlushingQueue = false
  }
}

function getAnalyticsProvider(config) {
  if (config.provider === 'cloudbase' && config.endpoint) {
    return createCloudbaseAnalyticsProvider(config)
  }

  return noopAnalyticsProvider
}

function trackAppErrors() {
  window.addEventListener('error', (event) => {
    track(ANALYTICS_EVENTS.APP_ERROR, {
      errorCode: event.error?.name || 'window_error',
      errorType: 'window_error',
      source: 'window',
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    track(ANALYTICS_EVENTS.APP_ERROR, {
      errorCode: event.reason?.name || 'unhandled_rejection',
      errorType: 'unhandled_rejection',
      source: 'window',
    })
  })
}

function createEventId() {
  const uniquePart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  return `event_${uniquePart}`
}
