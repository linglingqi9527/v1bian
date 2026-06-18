import { useCallback, useMemo, useState } from 'react'
import { createRecorderDraft, recorderStates } from '../features/trainings/recorderService.js'

export function useRecorder(options) {
  const [state, setState] = useState(recorderStates.idle)
  const draft = useMemo(() => createRecorderDraft(options ?? {}), [options])

  const start = useCallback(() => setState(recorderStates.recording), [])
  const stopForPreview = useCallback(() => setState(recorderStates.preview), [])
  const reset = useCallback(() => setState(recorderStates.idle), [])

  return {
    draft,
    isRecording: state === recorderStates.recording,
    reset,
    start,
    state,
    stopForPreview,
  }
}
