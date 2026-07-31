export const noopAnalyticsProvider = Object.freeze({
  async send() {
    return {
      delivered: true,
      retryable: false,
      skipped: true,
    }
  },
})
