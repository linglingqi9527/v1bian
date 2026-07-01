import { DEMO_USER_ID } from '../../models/userModel.js'

export const AUTH_UPDATED_EVENT = 'bianleme:auth-updated'

const AUTH_STORAGE_KEY = 'bianleme.auth.v1'
const LOCAL_LIBRARY_SESSION_STATUS_KEY = 'bianleme.localLibrary.sessionStatus.v1'
const LOCAL_USER_PREFIX = 'local:'
const DEVELOPER_PASSWORD_SALT = 'bianleme-developer-entry-v1'
const DEVELOPER_PASSWORD_HASH = '0fca148f4faf31957597397b59ac200fda8c8e6aa09ad2cc02c4c4bcdb48180c'

export function getAuthSnapshot() {
  const snapshot = readAuthSnapshot()
  const activeUser = snapshot.activeUserId ? snapshot.users?.[snapshot.activeUserId] : null
  const activeMode = snapshot.activeUserId === DEMO_USER_ID
    ? 'developer'
    : snapshot.activeUserId
      ? 'local'
      : 'guest'

  return {
    activeUserId: snapshot.activeUserId ?? null,
    activeDisplayName: activeUser?.displayName ?? '',
    activeMode,
    developerLoggedIn: snapshot.activeUserId === DEMO_USER_ID,
    localLoggedIn: Boolean(snapshot.activeUserId && snapshot.activeUserId !== DEMO_USER_ID),
    loggedIn: Boolean(snapshot.activeUserId),
    users: snapshot.users ?? {},
  }
}

export function getActiveUserId() {
  return getAuthSnapshot().activeUserId
}

export function isDemoUserLoggedIn() {
  return getAuthSnapshot().developerLoggedIn
}

export function isUserLoggedIn() {
  return getAuthSnapshot().loggedIn
}

export async function loginLocalUser(account, password) {
  const normalizedAccount = normalizeAccount(account)
  const normalizedPassword = password.trim()

  if (!normalizedAccount) {
    throw new Error('请输入账号')
  }
  if (!normalizedPassword) {
    throw new Error('请输入密码')
  }

  const snapshot = readAuthSnapshot()
  const userId = createLocalUserId(normalizedAccount)
  const localUser = snapshot.users?.[userId]

  if (!localUser?.passwordHash) {
    return createLocalUserAndLogin(snapshot, userId, normalizedAccount, normalizedPassword)
  }

  const passwordHash = await hashPassword(normalizedPassword, localUser.passwordSalt)
  if (passwordHash !== localUser.passwordHash) {
    throw new Error('密码不正确')
  }

  return activateUser(snapshot, userId, {
    ...localUser,
    lastLoginAt: new Date().toISOString(),
  })
}

export async function loginDeveloperUser(password) {
  const normalizedPassword = password.trim()
  if (!normalizedPassword) {
    throw new Error('请输入开发者密码')
  }

  const passwordHash = await hashPassword(normalizedPassword, DEVELOPER_PASSWORD_SALT)
  if (passwordHash !== DEVELOPER_PASSWORD_HASH) {
    throw new Error('开发者密码不正确')
  }

  const now = new Date().toISOString()
  const snapshot = readAuthSnapshot()
  const demoUser = snapshot.users?.[DEMO_USER_ID] ?? {}
  return activateUser(snapshot, DEMO_USER_ID, {
    id: DEMO_USER_ID,
    displayName: '开发者调试',
    type: 'developer',
    createdAt: demoUser.createdAt ?? now,
    updatedAt: now,
    lastLoginAt: now,
  })
}

export async function loginDemoUser(password) {
  return loginDeveloperUser(password)
}

export function logoutCurrentUser() {
  clearLocalLibrarySessionStatus()

  const snapshot = readAuthSnapshot()
  writeAuthSnapshot({
    ...snapshot,
    activeUserId: null,
  })
  emitAuthUpdated()
  return getAuthSnapshot()
}

export function logoutDemoUser() {
  return logoutCurrentUser()
}

async function createLocalUserAndLogin(snapshot, userId, account, password) {
  const now = new Date().toISOString()
  const passwordSalt = createSalt()
  const passwordHash = await hashPassword(password, passwordSalt)

  return activateUser(snapshot, userId, {
    id: userId,
    account,
    displayName: account,
    type: 'local',
    passwordHash,
    passwordSalt,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  })
}

function activateUser(snapshot, userId, user) {
  clearLocalLibrarySessionStatus()

  const nextSnapshot = {
    ...snapshot,
    activeUserId: userId,
    users: {
      ...snapshot.users,
      [userId]: user,
    },
  }

  writeAuthSnapshot(nextSnapshot)
  emitAuthUpdated()
  return getAuthSnapshot()
}

function readAuthSnapshot() {
  if (typeof window === 'undefined') return createEmptyAuthSnapshot()

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return createEmptyAuthSnapshot()

  try {
    return {
      ...createEmptyAuthSnapshot(),
      ...JSON.parse(raw),
    }
  } catch {
    return createEmptyAuthSnapshot()
  }
}

function writeAuthSnapshot(snapshot) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(snapshot))
}

function createEmptyAuthSnapshot() {
  return {
    activeUserId: null,
    users: {},
  }
}

function normalizeAccount(account) {
  return account.trim()
}

function createLocalUserId(account) {
  return `${LOCAL_USER_PREFIX}${account}`
}

async function hashPassword(password, salt) {
  const message = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', message)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function createSalt() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function emitAuthUpdated() {
  window.dispatchEvent(new Event(AUTH_UPDATED_EVENT))
}

function clearLocalLibrarySessionStatus() {
  if (typeof window === 'undefined') return

  window.sessionStorage.removeItem(LOCAL_LIBRARY_SESSION_STATUS_KEY)
}
