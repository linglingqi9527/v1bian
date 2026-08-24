const PHONE_SHORT_SIDE_MAX = 600

function getEnvironment(environment) {
  if (environment) return environment
  if (typeof window !== 'undefined') return window
  return null
}

export function getViewport(environment) {
  const runtime = getEnvironment(environment)
  const root = runtime?.document?.documentElement

  return {
    width: Math.round(root?.clientWidth || runtime?.innerWidth || 0),
    height: Math.round(Math.max(
      root?.clientHeight || 0,
      runtime?.innerHeight || 0,
      runtime?.visualViewport?.height || 0,
    )),
  }
}

export function getForcedLandscapeSize(viewport, environment) {
  const runtime = getEnvironment(environment)
  const shortSide = Math.min(viewport.width, viewport.height)
  const longSide = Math.max(viewport.width, viewport.height)
  const screenWidth = Number(runtime?.screen?.width) || 0
  const screenHeight = Number(runtime?.screen?.height) || 0
  const screenShort = Math.min(screenWidth, screenHeight)
  const screenLong = Math.max(screenWidth, screenHeight)
  const screenRatio = screenShort > 0
    ? Math.min(Math.max(screenLong / screenShort, 1), 3)
    : 1

  return {
    width: Math.ceil(Math.max(longSide, shortSide * screenRatio)),
    height: Math.ceil(shortSide),
  }
}

function orientationFromAngle(value) {
  const angle = Number(value)
  if (!Number.isFinite(angle)) return null

  const normalized = ((angle % 360) + 360) % 360
  return normalized === 90 || normalized === 270 ? 'landscape' : 'portrait'
}

export function getPhysicalOrientation(environment) {
  const runtime = getEnvironment(environment)
  const orientation = runtime?.screen?.orientation
  const type = typeof orientation?.type === 'string' ? orientation.type.toLowerCase() : ''
  const signals = []

  if (type.startsWith('landscape')) signals.push('landscape')
  if (type.startsWith('portrait')) signals.push('portrait')

  const screenAngle = orientationFromAngle(orientation?.angle)
  const legacyAngle = orientationFromAngle(runtime?.orientation)
  if (screenAngle) signals.push(screenAngle)
  if (legacyAngle) signals.push(legacyAngle)

  if (signals.includes('landscape')) return 'landscape'
  if (signals.includes('portrait')) return 'portrait'
  return 'unknown'
}

export function isTouchPhone(viewport, environment) {
  const runtime = getEnvironment(environment)
  const touchPoints = Number(runtime?.navigator?.maxTouchPoints) || 0
  if (touchPoints <= 0) return false

  const screenWidth = Number(runtime?.screen?.width) || 0
  const screenHeight = Number(runtime?.screen?.height) || 0
  const shortSides = [
    Math.min(viewport.width, viewport.height),
    screenWidth > 0 && screenHeight > 0 ? Math.min(screenWidth, screenHeight) : 0,
  ].filter((value) => value > 0)

  return shortSides.length > 0 && Math.min(...shortSides) <= PHONE_SHORT_SIDE_MAX
}

function isDesktopViewport(viewport, environment) {
  const runtime = getEnvironment(environment)
  const touchPoints = Number(runtime?.navigator?.maxTouchPoints) || 0
  if (touchPoints <= 0) return true

  const screenWidth = Number(runtime?.screen?.width) || 0
  const screenHeight = Number(runtime?.screen?.height) || 0
  const screenShort = screenWidth > 0 && screenHeight > 0
    ? Math.min(screenWidth, screenHeight)
    : 0
  const viewportShort = Math.min(viewport.width, viewport.height)

  return screenShort > PHONE_SHORT_SIDE_MAX && viewportShort > PHONE_SHORT_SIDE_MAX
}

export function readMobileLayout(environment, isAdminRoute = false) {
  const viewport = getViewport(environment)
  const physicalOrientation = getPhysicalOrientation(environment)
  const isPhone = !isAdminRoute && isTouchPhone(viewport, environment)
  const isNaturalLandscape = isPhone && (
    physicalOrientation === 'landscape'
    || (physicalOrientation === 'unknown' && viewport.width > viewport.height)
  )

  return {
    viewport,
    physicalOrientation,
    isPhone,
    isNaturalLandscape,
    isDesktopViewport: isDesktopViewport(viewport, environment),
  }
}

export function reconcileMobileLayout(current, nextLayout, allowPhysicalRelease = false) {
  const shouldReleaseForced = current.forcedSize && allowPhysicalRelease && (
    nextLayout.physicalOrientation === 'landscape'
    || (
      nextLayout.physicalOrientation === 'unknown'
      && nextLayout.viewport.width > nextLayout.viewport.height
    )
  )
  const canKeepForcedLayout = Boolean(current.forcedSize)
    && current.isPhone
    && !nextLayout.isDesktopViewport
  const keepsForcedLayout = canKeepForcedLayout && !shouldReleaseForced

  return {
    ...nextLayout,
    isPhone: keepsForcedLayout ? current.isPhone : nextLayout.isPhone,
    forcedSize: keepsForcedLayout ? current.forcedSize : null,
  }
}
