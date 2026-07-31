const REQUEST_TIMEOUT_MS = 3500

export function createCloudbaseAnalyticsProvider({ endpoint }) {
  return {
    async send(event) {
      const payload = JSON.stringify(event)

      if (canUseBeacon()) {
        const sent = navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }))
        if (sent) return { delivered: true, retryable: false }
      }

      try {
        const response = await fetchWithTimeout(endpoint, payload)
        return {
          delivered: response.ok,
          retryable: response.status >= 500,
        }
      } catch {
        return { delivered: false, retryable: true }
      }
    },
  }
}

function canUseBeacon() {
  return typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
}

async function fetchWithTimeout(endpoint, payload) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(endpoint, {
      body: payload,
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      method: 'POST',
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeoutId)
  }
}
