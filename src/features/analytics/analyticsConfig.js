const CONSENT_STORAGE_KEY = 'bianleme.analytics.preference.v1'

export function getAnalyticsConfig() {
  const enabledByEnvironment = import.meta.env.VITE_ANALYTICS_ENABLED === 'true'
  const enabledByUser = getAnalyticsPreference()
  const isDevelopment = import.meta.env.DEV
  const endpoint = String(import.meta.env.VITE_ANALYTICS_ENDPOINT ?? '').trim()
  const requestedProvider = String(import.meta.env.VITE_ANALYTICS_PROVIDER ?? '').trim()
  const canUseCloudbase = !isDevelopment && enabledByEnvironment && enabledByUser && requestedProvider === 'cloudbase' && Boolean(endpoint)

  return {
    appVersion: String(import.meta.env.VITE_APP_VERSION ?? '0.0.0'),
    enabled: canUseCloudbase,
    endpoint: canUseCloudbase ? endpoint : '',
    provider: canUseCloudbase ? 'cloudbase' : 'noop',
  }
}

export function setAnalyticsPreference(enabled) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(CONSENT_STORAGE_KEY, enabled ? 'enabled' : 'disabled')
}

export function getAnalyticsPreference() {
  if (typeof window === 'undefined') return true

  return window.localStorage.getItem(CONSENT_STORAGE_KEY) !== 'disabled'
}
