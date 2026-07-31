import { useEffect, useRef, useState } from 'react'

const AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
]

const VIDEO_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

const IDLE_WAVEFORM_LEVELS = [18, 26, 34, 24, 42, 54, 32, 22, 20, 48, 66, 44, 28, 20, 36, 58, 72, 40, 30, 52, 64, 38, 28, 22, 18, 16, 28, 40, 26]

export function useTrainingRecorder(mode) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState('')
  const [liveStream, setLiveStream] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [recordingBlob, setRecordingBlob] = useState(null)
  const [status, setStatus] = useState('idle')
  const [waveformLevels, setWaveformLevels] = useState(IDLE_WAVEFORM_LEVELS)
  const animationFrameRef = useRef(null)
  const audioContextRef = useRef(null)
  const chunksRef = useRef([])
  const elapsedBeforePauseRef = useRef(0)
  const lastWaveformUpdateRef = useRef(0)
  const noiseFloorRef = useRef(0.018)
  const smoothedVolumeRef = useRef(0)
  const waveformSeedRef = useRef(0)
  const previewUrlRef = useRef('')
  const recorderRef = useRef(null)
  const sourceRef = useRef(null)
  const startedAtRef = useRef(0)
  const streamRef = useRef(null)
  const timerRef = useRef(null)

  function clearTimer() {
    if (!timerRef.current) return
    window.clearInterval(timerRef.current)
    timerRef.current = null
  }

  function startTimer() {
    clearTimer()
    startedAtRef.current = Date.now()
    timerRef.current = window.setInterval(() => {
      setElapsedMs(elapsedBeforePauseRef.current + Date.now() - startedAtRef.current)
    }, 250)
  }

  function stopStream() {
    stopAnalyser()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setLiveStream(null)
  }

  function revokePreviewUrl() {
    if (!previewUrlRef.current) return
    URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = ''
  }

  function discard() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.stop()
    }

    clearTimer()
    stopStream()
    revokePreviewUrl()
    chunksRef.current = []
    elapsedBeforePauseRef.current = 0
    noiseFloorRef.current = 0.018
    recorderRef.current = null
    smoothedVolumeRef.current = 0
    setElapsedMs(0)
    setError('')
    setPreviewUrl('')
    setRecordingBlob(null)
    setStatus('idle')
    setWaveformLevels(IDLE_WAVEFORM_LEVELS)
  }

  function importRecording(file) {
    if (!file) return

    discard()
    const nextPreviewUrl = URL.createObjectURL(file)
    previewUrlRef.current = nextPreviewUrl
    setElapsedMs(0)
    setError('')
    setPreviewUrl(nextPreviewUrl)
    setRecordingBlob(file)
    setStatus('ready')
  }

  async function start() {
    discard()

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('当前浏览器不支持录音录像。请用最新版 Chrome / Edge 试一下。')
      setStatus('error')
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        mode === 'video'
          ? { audio: true, video: true }
          : { audio: true },
      )
      const mimeType = getSupportedMimeType(mode)
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []
      recorderRef.current = recorder
      streamRef.current = stream
      setLiveStream(stream)
      startAnalyser(stream)

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        clearTimer()
        stopStream()

        if (chunksRef.current.length === 0) {
          setError('这次没有采集到有效内容，可以重新录一次。')
          setStatus('error')
          return
        }

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType })
        const nextPreviewUrl = URL.createObjectURL(blob)
        revokePreviewUrl()
        previewUrlRef.current = nextPreviewUrl
        recorderRef.current = null
        setPreviewUrl(nextPreviewUrl)
        setRecordingBlob(blob)
        setStatus('ready')
      }

      recorder.start(250)
      elapsedBeforePauseRef.current = 0
      setElapsedMs(0)
      setError('')
      setStatus('recording')
      startTimer()
      return true
    } catch (recordingError) {
      stopStream()
      setError(getRecordingErrorMessage(recordingError))
      setStatus('error')
      return false
    }
  }

  function pause() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'recording') return

    recorder.pause()
    elapsedBeforePauseRef.current += Date.now() - startedAtRef.current
    setElapsedMs(elapsedBeforePauseRef.current)
    clearTimer()
    stopAnalyser()
    setWaveformLevels(IDLE_WAVEFORM_LEVELS)
    setStatus('paused')
  }

  function resume() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'paused') return

    recorder.resume()
    setStatus('recording')
    startAnalyser(streamRef.current)
    startTimer()
  }

  function stop() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    if (recorder.state === 'recording') {
      elapsedBeforePauseRef.current += Date.now() - startedAtRef.current
      setElapsedMs(elapsedBeforePauseRef.current)
    }
    clearTimer()
    stopAnalyser()
    setWaveformLevels(IDLE_WAVEFORM_LEVELS)
    setStatus('processing')
    recorder.stop()
  }

  function startAnalyser(stream) {
    if (!stream?.getAudioTracks().length) return

    stopAnalyser()

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextConstructor) return

    const audioContext = new AudioContextConstructor()
    const analyser = audioContext.createAnalyser()
    const source = audioContext.createMediaStreamSource(stream)
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.76
    const data = new Uint8Array(analyser.fftSize)
    source.connect(analyser)
    audioContextRef.current = audioContext
    sourceRef.current = source

    function tick() {
      analyser.getByteTimeDomainData(data)
      const now = performance.now()

      if (now - lastWaveformUpdateRef.current > 58) {
        lastWaveformUpdateRef.current = now
        waveformSeedRef.current += 1
        setWaveformLevels((currentLevels) => [
          ...currentLevels.slice(1),
          createNextWaveformLevel(data, waveformSeedRef.current, noiseFloorRef, smoothedVolumeRef),
        ])
      }

      animationFrameRef.current = window.requestAnimationFrame(tick)
    }

    tick()
  }

  function stopAnalyser() {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    sourceRef.current?.disconnect()
    sourceRef.current = null

    const audioContext = audioContextRef.current
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close()
    }
    audioContextRef.current = null
  }

  useEffect(() => () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.stop()
    }
    clearTimer()
    stopAnalyser()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  return {
    discard,
    elapsedMs,
    error,
    importRecording,
    liveStream,
    pause,
    previewUrl,
    recordingBlob,
    resume,
    start,
    status,
    stop,
    waveformLevels,
  }
}

function createNextWaveformLevel(data, seed, noiseFloorRef, smoothedVolumeRef) {
  const mean = data.reduce((sum, value) => sum + value, 0) / data.length
  const rms = Math.sqrt(
    data.reduce((sum, value) => {
      const normalized = (value - mean) / 128
      return sum + normalized * normalized
    }, 0) / data.length,
  )

  if (rms < noiseFloorRef.current * 1.8) {
    noiseFloorRef.current = noiseFloorRef.current * 0.94 + rms * 0.06
  }

  const effectiveFloor = Math.max(0.018, noiseFloorRef.current + 0.028)
  const signal = Math.max(0, rms - effectiveFloor)
  const normalizedVolume = Math.min(1, signal / 0.32)
  smoothedVolumeRef.current = smoothedVolumeRef.current * 0.72 + normalizedVolume * 0.28
  const clampedVolume = smoothedVolumeRef.current < 0.045 ? 0 : smoothedVolumeRef.current
  const handNoise = clampedVolume > 0.04
    ? Math.sin(seed * 1.73) * 6 + Math.sin(seed * 0.47) * 3
    : Math.sin(seed * 0.63) * 1.4
  const shaped = Math.pow(clampedVolume, 0.82)

  return Math.max(7, Math.round(9 + shaped * 164 + handNoise))
}

function getSupportedMimeType(mode) {
  const candidates = mode === 'video' ? VIDEO_MIME_TYPES : AUDIO_MIME_TYPES
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? ''
}

function getRecordingErrorMessage(error) {
  if (error?.name === 'NotAllowedError') return '没有获得麦克风或摄像头权限。'
  if (error?.name === 'NotFoundError') return '没有找到可用的麦克风或摄像头。'
  if (error?.name === 'NotReadableError') return '设备正在被其他程序占用。'
  return '录制启动失败，可以检查浏览器权限后再试。'
}
