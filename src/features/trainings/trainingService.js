import { demoTrainings } from '../../data/demoTrainings.js'
import { createTrainingModel } from '../../models/trainingModel.js'
import { DEMO_USER_ID } from '../../models/userModel.js'
import { addTrainingToMatch } from '../matches/matchService.js'
import { readLocalDb, writeLocalDb } from '../storage/localDb.js'

export function listTrainings() {
  const persistedTrainings = readLocalDb()?.trainings
  const trainings = Array.isArray(persistedTrainings) ? persistedTrainings : demoTrainings

  return trainings
    .map((training) => createTrainingModel(training))
    .filter((training) => training.userId === DEMO_USER_ID)
}

export function listTrainingsByReviewId(reviewId) {
  return listTrainings().filter((training) => training.reviewId === reviewId)
}

export function getTrainingById(trainingId) {
  return listTrainings().find((training) => training.id === trainingId)
}

export function saveTrainings(trainings) {
  const snapshot = readLocalDb() ?? {}
  writeLocalDb({
    ...snapshot,
    trainings: trainings.map((training) => createTrainingModel(training)),
  })
}

export function saveTrainingForMatch(matchId, trainingDraft = {}) {
  const savedTraining = createTrainingModel({
    ...trainingDraft,
    matchId,
  })
  const nextTrainings = [
    ...listTrainings().filter((training) => training.id !== savedTraining.id),
    savedTraining,
  ]

  saveTrainings(nextTrainings)
  addTrainingToMatch(matchId, savedTraining.id)

  return savedTraining
}
