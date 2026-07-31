import { getAuthSnapshot } from '../auth/authService.js'

export const LOCAL_LIBRARY_UPDATED_EVENT = 'bianleme:local-library-updated'

const DB_NAME = 'bianleme.localLibraryHandles.v1'
const DB_VERSION = 1
const STORE_NAME = 'handles'
const ACTIVE_HANDLE_ID = 'active-directory'
const DB_FILE_NAME = 'bianleme-db.json'
const SCHEMA_VERSION = 1
const UNSUPPORTED_MESSAGE = '当前浏览器暂不支持本地资料包模式，请使用 Chrome 或 Edge。'
const SESSION_STATUS_KEY = 'bianleme.localLibrary.sessionStatus.v1'
const LIBRARY_DIRECTORIES = {
  backups: 'backups',
  matches: '01-看比赛',
  reviews: '02-写赛评',
  trainings: '03-做训练',
}

let activeLibraryDbSnapshot = null
let pendingLibraryWrite = Promise.resolve()

export function isLocalLibrarySupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export function getLocalLibraryUnsupportedMessage() {
  return UNSUPPORTED_MESSAGE
}

export function hasConnectedLocalLibrary() {
  if (typeof window === 'undefined') return false

  try {
    const status = JSON.parse(window.sessionStorage.getItem(SESSION_STATUS_KEY) ?? 'null')
    return Boolean(status?.connected)
  } catch {
    return false
  }
}

export function getCachedLocalLibraryDb() {
  return activeLibraryDbSnapshot
}

export async function getSavedLocalLibraryStatus() {
  if (!isLocalLibrarySupported()) {
    const status = createDisconnectedStatus({ supported: false, message: UNSUPPORTED_MESSAGE })
    rememberLocalLibraryStatus(status)
    return status
  }

  const directoryHandle = await readSavedDirectoryHandle()
  if (!directoryHandle) {
    const status = createDisconnectedStatus({ supported: true })
    rememberLocalLibraryStatus(status)
    return status
  }

  const permission = await queryDirectoryPermission(directoryHandle)
  if (permission !== 'granted') {
    const status = createDisconnectedStatus({
      canReconnect: true,
      directoryName: directoryHandle.name,
      permission,
      supported: true,
    })
    rememberLocalLibraryStatus(status)
    return status
  }

  const status = createConnectedStatus(directoryHandle, await readLibraryDb(directoryHandle))
  rememberLocalLibraryStatus(status)
  return status
}

export async function chooseLocalLibrary() {
  if (!isLocalLibrarySupported()) {
    throw new Error(UNSUPPORTED_MESSAGE)
  }

  const directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
  await ensureDirectoryPermission(directoryHandle)
  const libraryDb = await initializeLocalLibrary(directoryHandle)
  await saveDirectoryHandle(directoryHandle)
  const status = createConnectedStatus(directoryHandle, libraryDb)
  rememberLocalLibraryStatus(status)
  emitLocalLibraryUpdated()
  return status
}

export async function reconnectSavedLocalLibrary() {
  if (!isLocalLibrarySupported()) {
    throw new Error(UNSUPPORTED_MESSAGE)
  }

  const directoryHandle = await readSavedDirectoryHandle()
  if (!directoryHandle) {
    return chooseLocalLibrary()
  }

  await ensureDirectoryPermission(directoryHandle)
  const libraryDb = await initializeLocalLibrary(directoryHandle)
  const status = createConnectedStatus(directoryHandle, libraryDb)
  rememberLocalLibraryStatus(status)
  emitLocalLibraryUpdated()
  return status
}

export function updateActiveLocalLibraryDb(updater) {
  if (activeLibraryDbSnapshot) {
    return queueActiveLibraryDbUpdate(updater)
  }

  return updateLibraryDbFromDisk(updater)
}

async function updateLibraryDbFromDisk(updater) {
  const directoryHandle = await getConnectedDirectoryHandle()
  const libraryDb = await initializeLocalLibrary(directoryHandle)
  activeLibraryDbSnapshot = libraryDb
  return queueActiveLibraryDbUpdate(updater)
}

function queueActiveLibraryDbUpdate(updater) {
  const nextLibraryDb = updater(activeLibraryDbSnapshot)
  const now = new Date().toISOString()
  const normalizedDb = {
    ...nextLibraryDb,
    meta: {
      ...nextLibraryDb.meta,
      updatedAt: now,
    },
  }

  activeLibraryDbSnapshot = normalizedDb
  emitLocalLibraryUpdated()

  pendingLibraryWrite = pendingLibraryWrite
    .catch(() => undefined)
    .then(async () => {
      const directoryHandle = await getConnectedDirectoryHandle()
      await writeLibraryDb(directoryHandle, normalizedDb)
      const status = createConnectedStatus(directoryHandle, normalizedDb)
      rememberLocalLibraryStatus(status)
      return normalizedDb
    })

  return pendingLibraryWrite
}

export async function writeLocalLibraryTrainingMediaFile({ blob, mediaId, mediaKind, sequence = 1, title, trainingId }) {
  const directoryHandle = await getConnectedDirectoryHandle()
  await initializeLocalLibrary(directoryHandle)

  const folderPath = createTrainingFolderPath(trainingId || mediaId, title)
  const targetDirectoryName = mediaKind === 'video' ? 'video' : 'audio'
  const targetDirectory = await getDirectoryByPath(directoryHandle, `${folderPath}/${targetDirectoryName}`, { create: true })
  const fileLabel = `${mediaKind === 'video' ? '录像' : '录音'}-${String(sequence).padStart(3, '0')}`
  const fileName = `${fileLabel}.${getMediaFileExtension(blob, mediaKind)}`
  const fileHandle = await targetDirectory.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()

  await writable.write(blob)
  await writable.close()

  return {
    folderPath,
    mediaPath: `${folderPath}/${targetDirectoryName}/${fileName}`,
    metaPath: `${folderPath}/meta.json`,
    notePath: `${folderPath}/批注.md`,
  }
}

export async function writeLocalLibraryTextFile(relativePath, content) {
  const directoryHandle = await getConnectedDirectoryHandle()
  await initializeLocalLibrary(directoryHandle)

  const { directory, fileName } = await getParentDirectoryAndFileName(directoryHandle, relativePath, { create: true })
  const fileHandle = await directory.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()

  await writable.write(content)
  await writable.close()
}

export async function writeLocalLibraryJsonFile(relativePath, value) {
  await writeLocalLibraryTextFile(relativePath, `${JSON.stringify(value, null, 2)}\n`)
}

export async function readLocalLibraryFileBlob(relativePath) {
  if (!relativePath) return null

  const directoryHandle = await getConnectedDirectoryHandle()
  const { directory, fileName } = await getParentDirectoryAndFileName(directoryHandle, relativePath)
  const fileHandle = await directory.getFileHandle(fileName)
  return fileHandle.getFile()
}

export async function removeLocalLibraryFile(relativePath) {
  if (!relativePath) return

  const directoryHandle = await getConnectedDirectoryHandle()
  const pathParts = relativePath.split('/').filter(Boolean)
  if (pathParts.length < 2) return

  const fileName = pathParts.at(-1)
  const directoryParts = pathParts.slice(0, -1)
  let currentDirectory = directoryHandle

  for (const directoryName of directoryParts) {
    currentDirectory = await currentDirectory.getDirectoryHandle(directoryName)
  }

  try {
    await currentDirectory.removeEntry(fileName)
  } catch (error) {
    if (error?.name !== 'NotFoundError') throw error
  }
}

export async function removeLocalLibraryEntry(relativePath, { recursive = false } = {}) {
  if (!relativePath) return

  const directoryHandle = await getConnectedDirectoryHandle()
  const pathParts = relativePath.split('/').filter(Boolean)
  if (pathParts.length === 0) return

  const entryName = pathParts.at(-1)
  const directoryParts = pathParts.slice(0, -1)
  let currentDirectory = directoryHandle

  for (const directoryName of directoryParts) {
    currentDirectory = await currentDirectory.getDirectoryHandle(directoryName)
  }

  try {
    await currentDirectory.removeEntry(entryName, { recursive })
  } catch (error) {
    if (error?.name !== 'NotFoundError') throw error
  }
}

async function initializeLocalLibrary(directoryHandle) {
  await directoryHandle.getDirectoryHandle(LIBRARY_DIRECTORIES.matches, { create: true })
  await directoryHandle.getDirectoryHandle(LIBRARY_DIRECTORIES.reviews, { create: true })
  await directoryHandle.getDirectoryHandle(LIBRARY_DIRECTORIES.trainings, { create: true })
  await directoryHandle.getDirectoryHandle(LIBRARY_DIRECTORIES.backups, { create: true })

  const dbFileHandle = await directoryHandle.getFileHandle(DB_FILE_NAME, { create: true })
  const file = await dbFileHandle.getFile()
  const existingText = await file.text()
  const existingDb = parseLibraryDb(existingText)
  const libraryDb = existingDb ?? createInitialLibraryDb()

  if (!existingDb) {
    await writeLibraryDb(directoryHandle, libraryDb)
  }

  return libraryDb
}

async function getDirectoryByPath(rootDirectory, relativePath, { create = false } = {}) {
  const pathParts = relativePath.split('/').filter(Boolean)
  let currentDirectory = rootDirectory

  for (const directoryName of pathParts) {
    currentDirectory = await currentDirectory.getDirectoryHandle(directoryName, { create })
  }

  return currentDirectory
}

async function getParentDirectoryAndFileName(rootDirectory, relativePath, { create = false } = {}) {
  const pathParts = relativePath.split('/').filter(Boolean)
  const fileName = pathParts.at(-1)
  const directoryPath = pathParts.slice(0, -1).join('/')
  const directory = directoryPath
    ? await getDirectoryByPath(rootDirectory, directoryPath, { create })
    : rootDirectory

  return { directory, fileName }
}

async function getConnectedDirectoryHandle() {
  if (!isLocalLibrarySupported()) {
    throw new Error(UNSUPPORTED_MESSAGE)
  }

  const directoryHandle = await readSavedDirectoryHandle()
  if (!directoryHandle) {
    throw new Error('请先选择本地资料包')
  }

  await ensureDirectoryPermission(directoryHandle)
  return directoryHandle
}

async function readLibraryDb(directoryHandle) {
  const dbFileHandle = await directoryHandle.getFileHandle(DB_FILE_NAME, { create: true })
  const file = await dbFileHandle.getFile()
  const text = await file.text()
  const libraryDb = parseLibraryDb(text)
  return libraryDb ?? initializeLocalLibrary(directoryHandle)
}

async function writeLibraryDb(directoryHandle, libraryDb) {
  const dbFileHandle = await directoryHandle.getFileHandle(DB_FILE_NAME, { create: true })
  const writable = await dbFileHandle.createWritable()
  await writable.write(JSON.stringify(libraryDb, null, 2))
  await writable.close()
}

function createInitialLibraryDb() {
  const now = new Date().toISOString()
  const authSnapshot = getAuthSnapshot()
  const activeUserId = authSnapshot.localLoggedIn ? authSnapshot.activeUserId : null
  const users = activeUserId
    ? [
        {
          id: activeUserId,
          displayName: authSnapshot.activeDisplayName,
          createdAt: now,
          updatedAt: now,
        },
      ]
    : []

  return {
    meta: {
      libraryId: createLibraryId(),
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      appVersionLastOpened: '0.0.0',
    },
    activeUserId,
    users,
    matchStates: {},
    reviews: [],
    trainings: [],
    settings: {},
  }
}

function parseLibraryDb(text) {
  if (!text.trim()) return null

  try {
    const parsed = JSON.parse(text)
    if (!parsed?.meta || typeof parsed.meta.schemaVersion !== 'number') {
      throw new Error('资料包数据库结构不正确')
    }
    return parsed
  } catch (error) {
    throw new Error(`无法读取 ${DB_FILE_NAME}：${error.message}`, { cause: error })
  }
}

function createConnectedStatus(directoryHandle, libraryDb) {
  activeLibraryDbSnapshot = libraryDb

  return {
    connected: true,
    directoryName: directoryHandle.name,
    libraryDb,
    meta: libraryDb.meta,
    permission: 'granted',
    supported: true,
  }
}

function createDisconnectedStatus({ canReconnect = false, directoryName = '', message = '', permission = 'prompt', supported }) {
  activeLibraryDbSnapshot = null

  return {
    canReconnect,
    connected: false,
    directoryName,
    libraryDb: null,
    message,
    meta: null,
    permission,
    supported,
  }
}

async function ensureDirectoryPermission(directoryHandle) {
  const permission = await queryDirectoryPermission(directoryHandle)
  if (permission === 'granted') return

  const requested = await directoryHandle.requestPermission?.({ mode: 'readwrite' })
  if (requested !== 'granted') {
    throw new Error('未获得本地资料包读写权限')
  }
}

async function queryDirectoryPermission(directoryHandle) {
  return await directoryHandle.queryPermission?.({ mode: 'readwrite' }) ?? 'prompt'
}

async function saveDirectoryHandle(directoryHandle) {
  const db = await openHandleDb()
  try {
    await runTransaction(db, 'readwrite', (store) => {
      store.put({
        id: ACTIVE_HANDLE_ID,
        directoryHandle,
        savedAt: new Date().toISOString(),
      })
    })
  } finally {
    db.close()
  }
}

async function readSavedDirectoryHandle() {
  const db = await openHandleDb()
  try {
    const result = await runRequest(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(ACTIVE_HANDLE_ID))
    return result?.directoryHandle ?? null
  } finally {
    db.close()
  }
}

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

function runTransaction(db, mode, action) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
    action(store)
  })
}

function runRequest(request) {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

function emitLocalLibraryUpdated() {
  window.dispatchEvent(new CustomEvent(LOCAL_LIBRARY_UPDATED_EVENT))
}

function rememberLocalLibraryStatus(status) {
  if (typeof window === 'undefined') return

  if (!status.connected) {
    window.sessionStorage.removeItem(SESSION_STATUS_KEY)
    return
  }

  window.sessionStorage.setItem(SESSION_STATUS_KEY, JSON.stringify({
    connected: true,
    directoryName: status.directoryName,
    updatedAt: new Date().toISOString(),
  }))
}

function getMediaFileExtension(blob, mediaKind) {
  const mimeType = blob?.type ?? ''
  const subtype = mimeType.split('/')[1]?.split(';')[0]?.trim()

  if (subtype) {
    if (subtype === 'quicktime') return 'mov'
    if (subtype === 'mpeg') return mediaKind === 'video' ? 'mpeg' : 'mp3'
    return subtype.replace(/[^a-z0-9-]/gi, '') || getDefaultMediaExtension(mediaKind)
  }

  return getDefaultMediaExtension(mediaKind)
}

function getDefaultMediaExtension(mediaKind) {
  return mediaKind === 'video' ? 'webm' : 'webm'
}

function createTrainingFolderPath(trainingId, title) {
  return `${LIBRARY_DIRECTORIES.trainings}/${trainingId}-${sanitizePathSegment(title || '未命名训练')}`
}

function sanitizePathSegment(value) {
  return String(value ?? '')
    .trim()
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code >= 32 && !'<>:"/\\|?*'.includes(character)
    })
    .join('')
    .replace(/\s+/g, ' ')
    .slice(0, 42) || '未命名'
}

function createLibraryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `library-${crypto.randomUUID()}`
  }

  return `library-${Date.now()}`
}
