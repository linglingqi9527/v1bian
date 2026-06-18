export const recorderStates = {
  idle: 'idle',
  recording: 'recording',
  preview: 'preview',
  saved: 'saved',
}

export function createRecorderDraft({ reviewId, matchId, mode = 'audio' }) {
  return {
    reviewId,
    matchId,
    mode,
    state: recorderStates.idle,
    previewUrl: null,
  }
}
