import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { MobileNav } from './MobileNav.jsx'
import { MobileOrientationNotice } from './MobileOrientationNotice.jsx'
import { SideNav } from './SideNav.jsx'
import {
  getForcedLandscapeSize,
  getViewport,
  readMobileLayout,
  reconcileMobileLayout,
} from './mobileLandscape.js'
import { HandDrawnAppFrame } from '../handdrawn/HandDrawnAppFrame.jsx'
import './SideNav.css'

export function AppShell({ children }) {
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const orientationTimerRef = useRef(null)
  const [layout, setLayout] = useState(() => ({
    ...readMobileLayout(),
    forcedSize: null,
  }))

  const refreshLayout = useCallback((allowPhysicalRelease = false) => {
    const nextLayout = readMobileLayout()

    setLayout((current) => reconcileMobileLayout(current, nextLayout, allowPhysicalRelease))
  }, [])

  useEffect(() => {
    function refreshAfterResize() {
      refreshLayout(false)
    }

    function refreshAfterPhysicalRotation() {
      window.clearTimeout(orientationTimerRef.current)
      orientationTimerRef.current = window.setTimeout(() => refreshLayout(true), 120)
    }

    window.addEventListener('resize', refreshAfterResize)
    window.addEventListener('orientationchange', refreshAfterPhysicalRotation)
    window.visualViewport?.addEventListener('resize', refreshAfterResize)
    window.screen?.orientation?.addEventListener?.('change', refreshAfterPhysicalRotation)

    return () => {
      window.clearTimeout(orientationTimerRef.current)
      window.removeEventListener('resize', refreshAfterResize)
      window.removeEventListener('orientationchange', refreshAfterPhysicalRotation)
      window.visualViewport?.removeEventListener('resize', refreshAfterResize)
      window.screen?.orientation?.removeEventListener?.('change', refreshAfterPhysicalRotation)
    }
  }, [refreshLayout])

  useEffect(() => {
    const root = document.documentElement
    const isPhone = layout.isPhone && !isAdminRoute
    const isForced = isPhone && Boolean(layout.forcedSize)
    const isPortraitView = isPhone && (isForced || !layout.isNaturalLandscape)
    const usesLandscapeLayout = isPhone && (isForced || layout.isNaturalLandscape)

    root.classList.toggle('mobile-phone-view', isPhone)
    root.classList.toggle('mobile-portrait-view', isPortraitView)
    root.classList.toggle('mobile-landscape-forced', isForced)
    root.classList.toggle('mobile-landscape-layout', usesLandscapeLayout)

    return () => {
      root.classList.remove(
        'mobile-phone-view',
        'mobile-portrait-view',
        'mobile-landscape-forced',
        'mobile-landscape-layout',
      )
    }
  }, [isAdminRoute, layout.forcedSize, layout.isNaturalLandscape, layout.isPhone])

  const requestManualLandscape = useCallback(() => {
    const viewport = getViewport()
    const forcedSize = getForcedLandscapeSize(viewport)

    setLayout((current) => ({
      ...current,
      viewport,
      isNaturalLandscape: false,
      forcedSize,
    }))
  }, [])

  const isPhone = layout.isPhone && !isAdminRoute
  const isForced = isPhone && Boolean(layout.forcedSize)
  const isPortraitView = isPhone && (isForced || !layout.isNaturalLandscape)
  const showOrientationNotice = isPortraitView && !isForced
  const shellClassName = [
    'app-shell',
    isPhone ? 'mobile-phone-view' : '',
    isPortraitView ? 'mobile-portrait-view' : '',
    isPhone && layout.isNaturalLandscape && !isForced ? 'mobile-landscape-natural' : '',
    isForced ? 'mobile-landscape-forced' : '',
  ].filter(Boolean).join(' ')
  const forcedStyle = isForced ? {
    '--mobile-landscape-width': `${layout.forcedSize.width}px`,
    '--mobile-landscape-height': `${layout.forcedSize.height}px`,
  } : undefined

  return (
    <>
      <MobileOrientationNotice
        isVisible={showOrientationNotice}
        onRequestLandscape={requestManualLandscape}
      />
      <div className={shellClassName} style={forcedStyle}>
        <SideNav />
        <main className="app-main">{children}</main>
        <MobileNav />
        <HandDrawnAppFrame />
      </div>
    </>
  )
}
