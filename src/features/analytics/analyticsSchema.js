export const ANALYTICS_SCHEMA_VERSION = 1

export function createAnalyticsEvent({ appVersion, category, eventId, eventName, identity, properties, sessionId }) {
  return {
    actor: {
      anonymousId: identity.anonymousId,
      cloudUserId: identity.cloudUserId,
      identityType: identity.identityType,
    },
    app: {
      appVersion,
      platform: 'web',
    },
    category,
    context: getAnalyticsContext(),
    eventId,
    eventName,
    occurredAt: new Date().toISOString(),
    properties,
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    sessionId,
  }
}

function getAnalyticsContext() {
  if (typeof window === 'undefined') {
    return {
      browserFamily: 'unknown',
      language: 'unknown',
      operatingSystem: 'unknown',
      path: '/',
    }
  }

  return {
    browserFamily: getBrowserFamily(navigator.userAgent),
    language: navigator.language || 'unknown',
    operatingSystem: getOperatingSystem(navigator.userAgent),
    path: window.location.pathname,
  }
}

function getBrowserFamily(userAgent) {
  if (/Edg\//.test(userAgent)) return 'Edge'
  if (/Chrome\//.test(userAgent) || /CriOS\//.test(userAgent)) return 'Chrome'
  if (/Firefox\//.test(userAgent)) return 'Firefox'
  if (/Safari\//.test(userAgent)) return 'Safari'
  return 'Other'
}

function getOperatingSystem(userAgent) {
  if (/Windows/.test(userAgent)) return 'Windows'
  if (/Android/.test(userAgent)) return 'Android'
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS'
  if (/Mac OS X/.test(userAgent)) return 'macOS'
  if (/Linux/.test(userAgent)) return 'Linux'
  return 'Other'
}
