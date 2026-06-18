import { demoTrainings } from '../../data/demoTrainings.js'
import { DEMO_USER_ID } from '../../models/userModel.js'

export function listTrainings() {
  return demoTrainings.filter((training) => training.userId === DEMO_USER_ID)
}

export function listTrainingsByReviewId(reviewId) {
  return listTrainings().filter((training) => training.reviewId === reviewId)
}

export function getTrainingById(trainingId) {
  return listTrainings().find((training) => training.id === trainingId)
}
