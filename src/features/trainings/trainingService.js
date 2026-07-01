import { demoTrainings } from '../../data/demoTrainings.js'
import { createTrainingModel } from '../../models/trainingModel.js'
import { getActiveUserId } from '../auth/authService.js'
import { addTrainingToMatch, removeTrainingFromMatches } from '../matches/matchService.js'
import {
  removeLocalLibraryEntry,
  removeLocalLibraryFile,
  getCachedLocalLibraryDb,
  readLocalLibraryFileBlob,
  updateActiveLocalLibraryDb,
  writeLocalLibraryJsonFile,
  writeLocalLibraryTextFile,
  writeLocalLibraryTrainingMediaFile,
} from '../storage/localLibraryService.js'
import { readLocalDb, writeLocalDb } from '../storage/localDb.js'
import { canWriteUserData, getUserDataAccessState, notifyUserDataBlocked } from '../storage/userDataAccess.js'
import { deleteTrainingMedia, getTrainingMedia, saveTrainingMedia } from './trainingMediaStore.js'

export const TRAININGS_UPDATED_EVENT = 'bianleme:trainings-updated'

export function listTrainings() {
  const activeUserId = getActiveUserId()
  const accessState = getUserDataAccessState()
  if (!activeUserId) return []

  if (accessState.mode === 'local') {
    const libraryTrainings = getCachedLocalLibraryDb()?.trainings
    return normalizeTrainingCollection(libraryTrainings, activeUserId)
  }

  if (accessState.mode !== 'developer') return []

  const persistedTrainings = readLocalDb()?.trainings
  const trainings = Array.isArray(persistedTrainings) ? persistedTrainings : demoTrainings

  return normalizeTrainingCollection(trainings, activeUserId)
}

function normalizeTrainingCollection(trainings, activeUserId) {
  return (Array.isArray(trainings) ? trainings : [])
    .map((training) => createTrainingModel(training))
    .filter((training) => training.userId === activeUserId)
}

export function listTrainingsByReviewId(reviewId) {
  return listTrainings().filter((training) => training.reviewId === reviewId)
}

export function getTrainingById(trainingId) {
  return listTrainings().find((training) => training.id === trainingId)
}

export function saveTrainings(trainings) {
  const accessState = getUserDataAccessState()
  if (!canWriteUserData()) {
    notifyUserDataBlocked()
    return
  }

  if (accessState.mode !== 'developer') {
    notifyTrainingsUpdated()
    return
  }

  const snapshot = readLocalDb() ?? {}
  writeLocalDb({
    ...snapshot,
    trainings: trainings.map((training) => createTrainingModel(training)),
  })
  notifyTrainingsUpdated()
}

export function saveTraining(trainingDraft = {}) {
  const activeUserId = getActiveUserId()
  if (!activeUserId || !canWriteUserData()) {
    notifyUserDataBlocked()
    return null
  }

  const existingTraining = trainingDraft.id ? getTrainingById(trainingDraft.id) : null
  const now = new Date().toISOString()
  const savedTraining = createTrainingModel({
    ...existingTraining,
    ...trainingDraft,
    id: trainingDraft.id ?? existingTraining?.id,
    userId: activeUserId,
    updatedAt: now,
    createdAt: existingTraining?.createdAt ?? trainingDraft.createdAt,
  })
  const nextTrainings = [
    ...listTrainings().filter((training) => training.id !== savedTraining.id),
    savedTraining,
  ]

  saveTrainings(nextTrainings)

  return savedTraining
}

export function saveTrainingForMatch(matchId, trainingDraft = {}) {
  const activeUserId = getActiveUserId()
  if (!activeUserId || !canWriteUserData()) {
    notifyUserDataBlocked()
    return null
  }

  const existingTraining = trainingDraft.id ? getTrainingById(trainingDraft.id) : null
  const now = new Date().toISOString()
  const savedTraining = createTrainingModel({
    ...existingTraining,
    ...trainingDraft,
    matchId,
    userId: activeUserId,
    updatedAt: now,
    createdAt: existingTraining?.createdAt ?? trainingDraft.createdAt,
  })
  const nextTrainings = [
    ...listTrainings().filter((training) => training.id !== savedTraining.id),
    savedTraining,
  ]

  saveTrainings(nextTrainings)
  addTrainingToMatch(matchId, savedTraining.id)

  return savedTraining
}

export function deleteTraining(trainingId, trainingSnapshot = null) {
  if (!trainingId) return

  const removingTraining = getTrainingById(trainingId) ?? trainingSnapshot
  saveTrainings(listTrainings().filter((training) => training.id !== trainingId))
  removeTrainingFromMatches(trainingId)

  if (getUserDataAccessState().mode === 'local') {
    void removeTrainingFromLocalLibrary(removingTraining)
  }
}

export async function saveTrainingMediaForActiveStorage(trainingId, blob, mode, title = '', sequence = 1) {
  const accessState = getUserDataAccessState()
  if (!accessState.allowed) {
    notifyUserDataBlocked()
    return null
  }

  const mediaId = `${trainingId}-media-${String(sequence).padStart(3, '0')}`

  if (accessState.mode === 'local') {
    const fileState = await writeLocalLibraryTrainingMediaFile({
      blob,
      mediaId,
      mediaKind: mode,
      sequence,
      title,
      trainingId,
    })

    return {
      folderPath: fileState.folderPath,
      mediaId,
      mediaPath: fileState.mediaPath,
      mediaType: blob.type,
      metaPath: fileState.metaPath,
      notePath: fileState.notePath,
    }
  }

  await saveTrainingMedia(mediaId, blob)
  return {
    mediaId,
    mediaPath: '',
    mediaType: blob.type,
  }
}

export async function deleteTrainingMediaForActiveStorage(training) {
  if (!training?.mediaId && !training?.mediaPath) return

  if (getUserDataAccessState().mode === 'local') {
    await removeLocalLibraryFile(training.mediaPath)
    return
  }

  await deleteTrainingMedia(training.mediaId)
}

export async function loadTrainingMediaForActiveStorage(mediaItem) {
  if (!mediaItem) return null

  if (getUserDataAccessState().mode === 'local') {
    return readLocalLibraryFileBlob(mediaItem.path || mediaItem.mediaPath)
  }

  const savedMedia = await getTrainingMedia(mediaItem.id || mediaItem.mediaId)
  return savedMedia?.blob ?? null
}

export async function syncTrainingToLocalLibrary(training) {
  if (!training || getUserDataAccessState().mode !== 'local') return null

  await writeTrainingSidecarFiles(training)

  return updateActiveLocalLibraryDb((libraryDb) => {
    const normalizedTraining = serializeTrainingForLibrary(training)
    const trainings = Array.isArray(libraryDb.trainings) ? libraryDb.trainings : []

    return {
      ...libraryDb,
      trainings: [
        ...trainings.filter((item) => item.id !== normalizedTraining.id),
        normalizedTraining,
      ],
    }
  })
}

async function removeTrainingFromLocalLibrary(training) {
  if (!training) return

  await updateActiveLocalLibraryDb((libraryDb) => ({
    ...libraryDb,
    trainings: Array.isArray(libraryDb.trainings)
      ? libraryDb.trainings.filter((item) => item.id !== training.id)
      : [],
  }))

  if (training.mediaPath) {
    await removeLocalLibraryFile(training.mediaPath)
  }
  if (training.folderPath) {
    await removeLocalLibraryEntry(training.folderPath, { recursive: true })
  }
}

function serializeTrainingForLibrary(training) {
  const now = new Date().toISOString()
  const mediaItems = Array.isArray(training.mediaItems) && training.mediaItems.length > 0
    ? training.mediaItems
    : createMediaItems(training)

  return {
    id: training.id,
    userId: training.userId,
    matchId: training.matchId ?? '',
    reviewId: training.reviewId ?? '',
    title: training.title ?? '',
    note: training.note ?? '',
    priority: training.priority ?? 'yellow',
    folderPath: training.folderPath ?? '',
    metaPath: training.metaPath ?? '',
    notePath: training.notePath ?? '',
    mediaItems,
    mediaType: training.mediaType ?? '',
    mediaPath: training.mediaPath ?? '',
    mode: training.mode ?? 'audio',
    durationMs: training.durationMs ?? 0,
    createdAt: training.createdAt ?? now,
    updatedAt: training.updatedAt ?? now,
  }
}

async function writeTrainingSidecarFiles(training) {
  if (!training.notePath || !training.metaPath) return

  await writeLocalLibraryTextFile(training.notePath, createTrainingNoteMarkdown(training))
  await writeLocalLibraryJsonFile(training.metaPath, serializeTrainingForLibrary(training))
}

function createTrainingNoteMarkdown(training) {
  return [
    `# ${training.title || '未命名训练'}`,
    '',
    `- 训练 ID：${training.id}`,
    `- 关联比赛：${training.matchId || '未关联'}`,
    `- 关联赛评：${training.reviewId || '未关联'}`,
    `- 训练模式：${training.mode === 'video' ? '录像' : '录音'}`,
    '',
    '## 批注',
    '',
    training.note || '',
    '',
  ].join('\n')
}

function createMediaItems(training) {
  if (!training.mediaPath) return []

  return [
    {
      id: training.mediaId || training.id,
      path: training.mediaPath,
      type: training.mode === 'video' ? 'video' : 'audio',
      mimeType: training.mediaType ?? '',
      durationMs: training.durationMs ?? 0,
    },
  ]
}

function notifyTrainingsUpdated() {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new Event(TRAININGS_UPDATED_EVENT))
}
