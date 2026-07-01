import { demoMatches } from '../../data/demoMatches.js'
import { createMatchModel } from '../../models/matchModel.js'
import { getActiveUserId } from '../auth/authService.js'
import { readLocalDb, writeLocalDb } from '../storage/localDb.js'
import { canWriteUserData, getUserDataAccessState, notifyUserDataBlocked } from '../storage/userDataAccess.js'

export function listMatches() {
  const activeUserId = getActiveUserId()
  const accessState = getUserDataAccessState()
  const canReadBrowserDebugData = activeUserId && accessState.mode === 'developer'
  const persistedMatches = canReadBrowserDebugData ? readLocalDb()?.matches : null
  const matches = canReadBrowserDebugData
    ? mergeMatchesWithPersistedState(demoMatches, persistedMatches)
    : demoMatches.map(stripUserMatchState)

  return matches
    .map((match) => createMatchModel(match))
}

export function getMatchById(matchId) {
  return listMatches().find((match) => match.id === matchId)
}

export function saveMatches(matches) {
  const accessState = getUserDataAccessState()
  if (!canWriteUserData()) {
    notifyUserDataBlocked()
    return
  }
  if (accessState.mode !== 'developer') return

  const snapshot = readLocalDb() ?? {}
  writeLocalDb({
    ...snapshot,
    matches: matches.map(serializeMatchState),
  })
}

export function updateMatch(matchId, patch) {
  const accessState = getUserDataAccessState()
  if (!canWriteUserData()) {
    notifyUserDataBlocked()
    return getMatchById(matchId)
  }
  if (accessState.mode !== 'developer') return getMatchById(matchId)

  let updatedMatch = null
  const matches = listMatches().map((match) => {
    if (match.id !== matchId) return match

    updatedMatch = createMatchModel({
      ...match,
      ...patch,
    })

    return updatedMatch
  })

  saveMatches(matches)
  return updatedMatch
}

export function toggleMatchFavorite(matchId) {
  const match = getMatchById(matchId)
  if (!match) return null

  return updateMatch(matchId, {
    favorite: !match.favorite,
  })
}

export function markMatchWatched(matchId) {
  return updateMatch(matchId, {
    watched: true,
    status: '已看',
  })
}

export function toggleMatchWatched(matchId) {
  const match = getMatchById(matchId)
  if (!match) return null

  return updateMatch(matchId, {
    watched: !match.watched,
    status: match.watched ? '未看' : '已看',
  })
}

export function setMatchReviewId(matchId, reviewId) {
  if (!reviewId) return getMatchById(matchId)

  return updateMatch(matchId, {
    reviewId,
  })
}

export function clearMatchReviewId(matchId, reviewId = '') {
  const match = getMatchById(matchId)
  if (!match) return null
  if (reviewId && match.reviewId !== reviewId) return match

  return updateMatch(matchId, {
    reviewId: null,
  })
}

export function addTrainingToMatch(matchId, trainingId) {
  const match = getMatchById(matchId)
  if (!match || !trainingId) return match ?? null

  return updateMatch(matchId, {
    trainingIds: Array.from(new Set([...match.trainingIds, trainingId])),
  })
}

export function removeTrainingFromMatches(trainingId) {
  if (!trainingId) return

  saveMatches(listMatches().map((match) => ({
    ...match,
    trainingIds: match.trainingIds.filter((id) => id !== trainingId),
  })))
}

function mergeMatchesWithPersistedState(baseMatches, persistedMatches) {
  if (!Array.isArray(persistedMatches)) return baseMatches

  const persistedById = new Map(persistedMatches.map((match) => [match.id, match]))
  return baseMatches.map((match) => ({
    ...match,
    ...pickPersistedMatchState(persistedById.get(match.id)),
  }))
}

function serializeMatchState(match) {
  return {
    id: match.id,
    favorite: Boolean(match.favorite),
    watched: Boolean(match.watched),
    reviewId: match.reviewId ?? null,
    status: match.watched ? '已看' : '未看',
    trainingIds: Array.isArray(match.trainingIds) ? match.trainingIds : [],
  }
}

function pickPersistedMatchState(match) {
  if (!match) return {}
  const state = {}

  if (Object.hasOwn(match, 'favorite')) state.favorite = Boolean(match.favorite)
  if (Object.hasOwn(match, 'watched')) state.watched = Boolean(match.watched)
  if (Object.hasOwn(match, 'reviewId')) state.reviewId = match.reviewId ?? null
  if (Object.hasOwn(match, 'status')) state.status = match.status
  if (Object.hasOwn(match, 'trainingIds')) {
    state.trainingIds = Array.isArray(match.trainingIds) ? match.trainingIds : []
  }

  return state
}

function stripUserMatchState(match) {
  return {
    ...match,
    favorite: false,
    reviewId: null,
    status: '未看',
    trainingIds: [],
    watched: false,
  }
}
