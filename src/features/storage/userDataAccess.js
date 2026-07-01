import { getAuthSnapshot } from '../auth/authService.js'
import { hasConnectedLocalLibrary } from './localLibraryService.js'

export const USER_DATA_BLOCKED_EVENT = 'bianleme:user-data-blocked'

export function getUserDataAccessState() {
  const authSnapshot = getAuthSnapshot()

  if (authSnapshot.developerLoggedIn) {
    return {
      allowed: true,
      mode: 'developer',
      message: '',
    }
  }

  if (!authSnapshot.localLoggedIn) {
    return {
      allowed: false,
      mode: 'guest',
      message: '请先登录本地身份。',
    }
  }

  if (!hasConnectedLocalLibrary()) {
    return {
      allowed: false,
      mode: 'local-without-library',
      message: '请先在登录页选择本地资料包，再进行收藏、赛评或训练。',
    }
  }

  return {
    allowed: true,
    mode: 'local',
    message: '',
  }
}

export function canReadUserData() {
  return getUserDataAccessState().allowed
}

export function canWriteUserData() {
  return getUserDataAccessState().allowed
}

export function notifyUserDataBlocked({ silent = false } = {}) {
  const accessState = getUserDataAccessState()
  if (accessState.allowed || typeof window === 'undefined') return false

  window.dispatchEvent(new CustomEvent(USER_DATA_BLOCKED_EVENT, {
    detail: {
      message: accessState.message,
      mode: accessState.mode,
    },
  }))

  if (!silent) {
    window.alert(accessState.message)
  }

  return true
}
