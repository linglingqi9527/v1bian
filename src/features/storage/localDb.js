const STORAGE_KEY = 'bianleme.localDb.v1'

export function readLocalDb() {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

export function writeLocalDb(snapshot) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

export function clearLocalDb() {
  if (typeof window === 'undefined') return

  window.localStorage.removeItem(STORAGE_KEY)
}
