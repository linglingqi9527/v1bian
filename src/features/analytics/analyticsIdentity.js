const IDENTITY_STORAGE_KEY = 'bianleme.analytics.identity.v1'
const SESSION_STORAGE_KEY = 'bianleme.analytics.session.v1'

export function getAnalyticsIdentity() {
  const snapshot = readIdentitySnapshot()
  const anonymousId = snapshot.anonymousId || createIdentifier('anon')
  const cloudUserId = snapshot.cloudUserId || null

  if (anonymousId !== snapshot.anonymousId) {
    writeIdentitySnapshot({ ...snapshot, anonymousId })
  }

  return {
    anonymousId,
    cloudUserId,
    identityType: cloudUserId ? 'cloud' : 'anonymous',
  }
}

export function getAnalyticsSessionId() {
  if (typeof window === 'undefined') return createIdentifier('session')

  const existingSessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (existingSessionId) return existingSessionId

  const sessionId = createIdentifier('session')
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId)
  return sessionId
}

export function setCloudIdentity(cloudUserId) {
  const normalizedCloudUserId = String(cloudUserId ?? '').trim()
  if (!normalizedCloudUserId) return getAnalyticsIdentity()

  const snapshot = readIdentitySnapshot()
  writeIdentitySnapshot({
    ...snapshot,
    anonymousId: snapshot.anonymousId || createIdentifier('anon'),
    cloudUserId: normalizedCloudUserId,
  })
  return getAnalyticsIdentity()
}

export function clearCloudIdentity() {
  const snapshot = readIdentitySnapshot()
  writeIdentitySnapshot({
    ...snapshot,
    cloudUserId: null,
  })
  return getAnalyticsIdentity()
}

function readIdentitySnapshot() {
  if (typeof window === 'undefined') return { anonymousId: '', cloudUserId: null }

  try {
    const raw = window.localStorage.getItem(IDENTITY_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      anonymousId: typeof parsed.anonymousId === 'string' ? parsed.anonymousId : '',
      cloudUserId: typeof parsed.cloudUserId === 'string' ? parsed.cloudUserId : null,
    }
  } catch {
    return { anonymousId: '', cloudUserId: null }
  }
}

function writeIdentitySnapshot(snapshot) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(snapshot))
}

function createIdentifier(prefix) {
  const uniquePart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  return `${prefix}_${uniquePart}`
}
