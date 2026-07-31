import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { ANALYTICS_EVENTS } from '../analyticsEvents.js'
import { initializeAnalytics, track } from '../analyticsService.js'

export function usePageViewTracking() {
  const location = useLocation()
  const previousLocationKeyRef = useRef('')
  const locationKey = `${location.pathname}${location.search}`

  useEffect(() => {
    if (previousLocationKeyRef.current === locationKey) return

    previousLocationKeyRef.current = locationKey
    initializeAnalytics()
    track(ANALYTICS_EVENTS.PAGE_VIEW, {
      path: location.pathname,
      source: 'router',
    })
  }, [location.pathname, locationKey])
}
