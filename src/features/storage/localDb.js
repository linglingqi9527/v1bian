const STORAGE_KEY = 'bianleme.localDb.v1'

export function readLocalDb() {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

export function writeLocalDb(snapshot) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

export function clearLocalDb() {
  window.localStorage.removeItem(STORAGE_KEY)
}
