import { getAnalyticsEventDefinition } from './analyticsEvents.js'

const FORBIDDEN_PROPERTY_NAMES = new Set([
  'accessToken',
  'audioBlob',
  'blob',
  'content',
  'contentHtml',
  'directoryName',
  'email',
  'filePath',
  'localPath',
  'mediaPath',
  'note',
  'password',
  'passwordHash',
  'phone',
  'realName',
  'refreshToken',
  'reviewBody',
  'transcript',
  'username',
  'videoBlob',
])

const NUMBER_FIELDS = new Set(['contentLength', 'durationMs'])
const BOOLEAN_FIELDS = new Set(['connected', 'favorite', 'success', 'watched'])
const MAX_STRING_LENGTH = 160

export function sanitizeAnalyticsProperties(eventName, properties = {}) {
  const definition = getAnalyticsEventDefinition(eventName)
  if (!definition || !properties || typeof properties !== 'object') return {}

  const allowedProperties = new Set(definition.allowedProperties)
  const sanitized = {}

  Object.entries(properties).forEach(([key, value]) => {
    if (!allowedProperties.has(key) || FORBIDDEN_PROPERTY_NAMES.has(key)) {
      warnAboutRejectedAnalyticsProperty(key)
      return
    }

    const normalizedValue = normalizeAllowedValue(key, value)
    if (normalizedValue === undefined) return
    sanitized[key] = normalizedValue
  })

  return sanitized
}

function normalizeAllowedValue(key, value) {
  if (NUMBER_FIELDS.has(key)) {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined
  }

  if (BOOLEAN_FIELDS.has(key)) {
    return typeof value === 'boolean' ? value : undefined
  }

  if (typeof value !== 'string') return undefined
  const normalizedValue = value.trim()
  return normalizedValue ? normalizedValue.slice(0, MAX_STRING_LENGTH) : undefined
}

function warnAboutRejectedAnalyticsProperty(key) {
  if (!import.meta.env.DEV) return

  console.warn(`[analytics] 已忽略不允许上报的字段：${key}`)
}
