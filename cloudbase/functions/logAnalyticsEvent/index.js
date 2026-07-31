const cloudbase = require('@cloudbase/node-sdk')

const app = cloudbase.init({})
const db = app.database()
const COLLECTION_NAME = 'analytics_events'
const SCHEMA_VERSION = 1
const MAX_STRING_LENGTH = 160
const FORBIDDEN_FIELDS = new Set([
  'accessToken', 'audioBlob', 'blob', 'content', 'contentHtml', 'directoryName',
  'email', 'filePath', 'localPath', 'mediaPath', 'note', 'password', 'passwordHash',
  'phone', 'realName', 'refreshToken', 'reviewBody', 'transcript', 'username', 'videoBlob',
])
const EVENT_DEFINITIONS = {
  app_open: { category: 'app', properties: [] },
  app_error: { category: 'error', properties: ['errorCode', 'errorType', 'source'] },
  local_library_connected: { category: 'local_library', properties: ['connected', 'success'] },
  local_library_connection_failed: { category: 'local_library', properties: ['connected', 'errorCode', 'errorType', 'success'] },
  match_favorite_changed: { category: 'match', properties: ['favorite', 'matchId', 'success'] },
  match_watched_changed: { category: 'match', properties: ['matchId', 'success', 'watched'] },
  page_view: { category: 'navigation', properties: ['path', 'source'] },
  recording_started: { category: 'training', properties: ['matchId', 'mediaType', 'success', 'trainingId'] },
  recording_stopped: { category: 'training', properties: ['durationMs', 'matchId', 'mediaType', 'success', 'trainingId'] },
  review_editor_opened: { category: 'review', properties: ['matchId', 'reviewId', 'source'] },
  review_saved: { category: 'review', properties: ['contentLength', 'contentLengthRange', 'matchId', 'reviewId', 'source', 'status', 'success'] },
  training_editor_opened: { category: 'training', properties: ['matchId', 'mediaType', 'reviewId', 'source', 'trainingId'] },
  training_saved: { category: 'training', properties: ['durationMs', 'matchId', 'mediaType', 'reviewId', 'source', 'success', 'trainingId'] },
}
const NUMBER_FIELDS = new Set(['contentLength', 'durationMs'])
const BOOLEAN_FIELDS = new Set(['connected', 'favorite', 'success', 'watched'])

async function main(event) {
  if (event?.httpMethod === 'OPTIONS') return response(204, {})
  if (event?.httpMethod && event.httpMethod !== 'POST') return response(405, { error: 'method_not_allowed' })

  const input = parseRequestBody(event)
  const validation = validateEvent(input)
  if (!validation.valid) return response(400, { error: validation.error })

  const eventId = validation.event.eventId
  const eventDocument = {
    ...validation.event,
    _id: eventId,
    receivedAt: new Date().toISOString(),
  }

  try {
    const existing = await db.collection(COLLECTION_NAME).doc(eventId).get()
    if (existing?.data) return response(200, { duplicate: true, ok: true })
  } catch {
    // 文档不存在时继续写入；不向客户端暴露数据库细节。
  }

  try {
    await db.collection(COLLECTION_NAME).doc(eventId).set(eventDocument)
    return response(200, { duplicate: false, ok: true })
  } catch {
    return response(500, { error: 'storage_failed' })
  }
}

// Kept as a small pure handler so the HTTP server can be replaced without
// changing validation or persistence behavior.
exports.main = main

function parseRequestBody(event) {
  const body = event?.body ?? event
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return null
    }
  }

  return body && typeof body === 'object' ? body : null
}

function validateEvent(event) {
  if (!event || typeof event !== 'object') return invalid('invalid_body')
  if (containsForbiddenField(event)) return invalid('forbidden_field')
  if (event.schemaVersion !== SCHEMA_VERSION) return invalid('unsupported_schema_version')
  if (!isSafeIdentifier(event.eventId, 200)) return invalid('invalid_event_id')

  const definition = EVENT_DEFINITIONS[event.eventName]
  if (!definition || event.category !== definition.category) return invalid('invalid_event_name')
  if (!isIsoDate(event.occurredAt) || !isSafeIdentifier(event.sessionId, 200)) return invalid('invalid_event_context')
  if (!validateActor(event.actor) || !validateApp(event.app) || !validateContext(event.context)) return invalid('invalid_metadata')

  const properties = sanitizeProperties(event.properties, definition.properties)
  if (properties === null) return invalid('invalid_properties')

  return {
    event: {
      actor: {
        anonymousId: event.actor.anonymousId,
        cloudUserId: event.actor.cloudUserId ?? null,
        identityType: event.actor.identityType,
      },
      app: {
        appVersion: event.app.appVersion,
        platform: event.app.platform,
      },
      category: event.category,
      context: {
        browserFamily: event.context.browserFamily,
        language: event.context.language,
        operatingSystem: event.context.operatingSystem,
        path: event.context.path,
      },
      eventId: event.eventId,
      eventName: event.eventName,
      occurredAt: event.occurredAt,
      properties,
      schemaVersion: event.schemaVersion,
      sessionId: event.sessionId,
    },
    valid: true,
  }
}

function validateActor(actor) {
  if (!actor || typeof actor !== 'object') return false
  if (!['anonymous', 'cloud'].includes(actor.identityType)) return false
  if (!isSafeIdentifier(actor.anonymousId, 200)) return false
  if (actor.cloudUserId !== null && actor.cloudUserId !== undefined && !isSafeIdentifier(actor.cloudUserId, 200)) return false
  return actor.identityType === 'cloud' ? Boolean(actor.cloudUserId) : actor.cloudUserId === null
}

function validateApp(appMetadata) {
  return Boolean(appMetadata)
    && appMetadata.platform === 'web'
    && isShortString(appMetadata.appVersion)
}

function validateContext(context) {
  return Boolean(context)
    && isShortString(context.browserFamily)
    && isShortString(context.language)
    && isShortString(context.operatingSystem)
    && typeof context.path === 'string'
    && context.path.startsWith('/')
    && context.path.length <= MAX_STRING_LENGTH
}

function sanitizeProperties(properties, allowedFields) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return null

  const allowed = new Set(allowedFields)
  const sanitized = {}
  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.has(key) || FORBIDDEN_FIELDS.has(key)) return null
    if (NUMBER_FIELDS.has(key)) {
      if (!Number.isFinite(value) || value < 0) return null
      sanitized[key] = Math.round(value)
      continue
    }
    if (BOOLEAN_FIELDS.has(key)) {
      if (typeof value !== 'boolean') return null
      sanitized[key] = value
      continue
    }
    if (!isShortString(value)) return null
    sanitized[key] = value
  }
  return sanitized
}

function containsForbiddenField(value) {
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, nestedValue]) => {
    if (FORBIDDEN_FIELDS.has(key)) return true
    return containsForbiddenField(nestedValue)
  })
}

function isSafeIdentifier(value, maxLength) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

function isShortString(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_STRING_LENGTH
}

function isIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
}

function invalid(error) {
  return { error, valid: false }
}

function response(statusCode, payload) {
  return {
    body: JSON.stringify(payload),
    headers: {
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-origin': '*',
      'content-type': 'application/json; charset=utf-8',
    },
    statusCode,
  }
}
