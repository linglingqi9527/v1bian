const DB_NAME = 'bianleme.trainingMedia.v1'
const DB_VERSION = 1
const STORE_NAME = 'recordings'

export async function saveTrainingMedia(mediaId, blob) {
  const db = await openTrainingMediaDb()

  try {
    await runTransaction(db, 'readwrite', (store) => {
      store.put({
        id: mediaId,
        blob,
        size: blob.size,
        type: blob.type,
        updatedAt: new Date().toISOString(),
      })
    })
  } finally {
    db.close()
  }
}

export async function getTrainingMedia(mediaId) {
  const db = await openTrainingMediaDb()

  try {
    return await runRequest(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(mediaId))
  } finally {
    db.close()
  }
}

export async function deleteTrainingMedia(mediaId) {
  const db = await openTrainingMediaDb()

  try {
    await runTransaction(db, 'readwrite', (store) => {
      store.delete(mediaId)
    })
  } finally {
    db.close()
  }
}

function openTrainingMediaDb() {
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
