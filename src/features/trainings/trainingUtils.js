export function canSaveTraining(recordingState) {
  return recordingState === 'preview'
}

export function getTrainingReviewRoute(reviewId) {
  return `/trainings/new?reviewId=${reviewId}`
}
