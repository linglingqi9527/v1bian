import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, MessageSquareText, Pause, Play, RotateCcw, Save, Square, Upload, X } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { WorkbenchHeader } from '../design-system/layout/WorkbenchHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { imageAssets } from '../assets/assetPaths.js'
import { ANALYTICS_EVENTS, track } from '../features/analytics/index.js'
import { getUserDataAccessState } from '../features/storage/userDataAccess.js'
import {
  deleteTraining,
  deleteTrainingMediaForActiveStorage,
  getTrainingById,
  loadTrainingMediaForActiveStorage,
  saveTraining,
  saveTrainingForMatch,
  saveTrainingMediaForActiveStorage,
  syncTrainingToLocalLibrary,
} from '../features/trainings/trainingService.js'
import { useTrainingRecorder } from '../features/trainings/useTrainingRecorder.js'
import { createId } from '../utils/ids.js'
import '../features/trainings/components/TrainingCreateLayout.css'

const TRAINING_AUTO_SAVE_DELAY_MS = 900
const TRAINING_SAVE_FEEDBACK_MS = 2200

export default function TrainingCreatePage() {
  const { trainingId: routeTrainingId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const existingTraining = routeTrainingId ? getTrainingById(routeTrainingId) : null
  const matchId = searchParams.get('matchId') || existingTraining?.matchId || ''
  const reviewId = searchParams.get('reviewId') || existingTraining?.reviewId || ''
  const [mode, setMode] = useState(() => existingTraining?.mode || 'audio')
  const [isSaving, setIsSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState('')
  const [materialItems, setMaterialItems] = useState([])
  const [trainingSessionId] = useState(() => routeTrainingId || createId('training'))
  const [activeAudioId, setActiveAudioId] = useState('')
  const fileInputRef = useRef(null)
  const liveVideoRef = useRef(null)
  const materialUrlsRef = useRef([])
  const hydratedTrainingIdRef = useRef('')
  const hasTrackedEditorOpenRef = useRef(false)
  const recorder = useTrainingRecorder(mode)
  const modeLabel = mode === 'video' ? '录像' : '录音'
  const isRecordingLocked = recorder.status === 'recording' || recorder.status === 'paused' || recorder.status === 'processing'
  const [trainingDraft, setTrainingDraft] = useState(() => ({
    date: '2026-01-24',
    duration: '02:07:09',
    event: '新国辩半决赛',
    note: existingTraining?.note || '控制语速，首段立场要明确，结尾注意收束。',
    teams: '香港大学 vs 北京师范大学',
    title: existingTraining?.title || 'AI的迅猛发展提升了 / 降低了人类创作者存在的意义',
  }))

  useEffect(() => {
    if (hasTrackedEditorOpenRef.current) return

    hasTrackedEditorOpenRef.current = true
    track(ANALYTICS_EVENTS.TRAINING_EDITOR_OPENED, {
      matchId,
      mediaType: mode,
      reviewId,
      source: routeTrainingId ? 'training_list' : 'new_training',
      trainingId: trainingSessionId,
    })
  }, [matchId, mode, reviewId, routeTrainingId, trainingSessionId])

  useEffect(() => {
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = recorder.liveStream
    }
  }, [recorder.liveStream])

  useEffect(() => {
    if (!existingTraining || hydratedTrainingIdRef.current === existingTraining.id) return

    hydratedTrainingIdRef.current = existingTraining.id
    setTrainingDraft((current) => ({
      ...current,
      note: existingTraining.note || current.note,
      title: existingTraining.title || current.title,
    }))
    setMode(existingTraining.mode || 'audio')

    const savedMediaItems = getSavedTrainingMediaItems(existingTraining)
    if (savedMediaItems.length === 0) return

    Promise.all(savedMediaItems.map(async (mediaItem) => {
      try {
        const blob = await loadTrainingMediaForActiveStorage(mediaItem)
        if (!blob) return null
        return createMaterialItem(blob, mediaItem.type || existingTraining.mode, mediaItem.durationMs || 0, existingTraining.id, {
          folderPath: existingTraining.folderPath,
          mediaId: mediaItem.id,
          mediaPath: mediaItem.path || existingTraining.mediaPath,
          mediaType: mediaItem.mimeType,
          metaPath: existingTraining.metaPath,
          notePath: existingTraining.notePath,
        })
      } catch {
        return null
      }
    })).then((items) => {
      const hydratedItems = items.filter(Boolean)
      if (hydratedItems.length === 0) return

      materialUrlsRef.current.push(...hydratedItems.map((item) => item.previewUrl))
      setMaterialItems(hydratedItems)
    })
  }, [existingTraining])

  const appendMaterialItem = useCallback((materialItem) => {
    const previewUrl = materialItem.previewUrl
    materialUrlsRef.current.push(previewUrl)
    setMaterialItems((current) => [
      ...current,
      materialItem,
    ])
  }, [])

  useEffect(() => () => {
    materialUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const showSaveNotice = useCallback((message) => {
    setSaveNotice(message)
    window.setTimeout(() => setSaveNotice(''), TRAINING_SAVE_FEEDBACK_MS)
  }, [])

  const persistSavedTrainingItems = useCallback(async (items, { notice = '', trackSave = false } = {}) => {
    const accessState = getUserDataAccessState()
    if (!accessState.allowed) {
      window.alert(accessState.message)
      return null
    }

    const savedDraft = createTrainingDraftFromMaterials(items, {
      matchId,
      note: trainingDraft.note,
      reviewId,
      title: trainingDraft.title,
      trainingId: trainingSessionId,
    })
    if (!savedDraft) return null

    const savedTraining = matchId
      ? saveTrainingForMatch(matchId, savedDraft)
      : saveTraining(savedDraft)
    if (!savedTraining) return null

    await syncTrainingToLocalLibrary(savedTraining)

    if (trackSave) {
      track(ANALYTICS_EVENTS.TRAINING_SAVED, {
        durationMs: savedTraining.durationMs,
        matchId: savedTraining.matchId,
        mediaType: savedTraining.mode,
        reviewId: savedTraining.reviewId,
        source: 'manual',
        success: true,
        trainingId: savedTraining.id,
      })
    }

    if (notice) showSaveNotice(notice)
    return savedTraining
  }, [matchId, reviewId, showSaveNotice, trainingDraft.note, trainingDraft.title, trainingSessionId])

  useEffect(() => {
    const savedItems = materialItems.filter((item) => item.trainingId)
    if (savedItems.length === 0) return undefined

    const timer = window.setTimeout(() => {
      void persistSavedTrainingItems(savedItems, { notice: '已自动保存' })
    }, TRAINING_AUTO_SAVE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [materialItems, persistSavedTrainingItems])

  function updateTrainingDraft(field, value) {
    setTrainingDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleModeChange(nextMode) {
    if (mode === nextMode || isRecordingLocked) return
    handleDiscardRecording()
    setMode(nextMode)
  }

  async function handleStartRecording() {
    const started = await recorder.start()
    if (!started) return

    track(ANALYTICS_EVENTS.RECORDING_STARTED, {
      matchId,
      mediaType: mode,
      success: true,
      trainingId: trainingSessionId,
    })
  }

  function handleStopRecording() {
    if (recorder.status !== 'recording' && recorder.status !== 'paused') return

    const durationMs = recorder.elapsedMs
    recorder.stop()
    track(ANALYTICS_EVENTS.RECORDING_STOPPED, {
      durationMs,
      matchId,
      mediaType: mode,
      success: true,
      trainingId: trainingSessionId,
    })
  }

  function handleDiscardRecording() {
    recorder.discard()
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const nextMode = file.type.startsWith('video/') ? 'video' : 'audio'
    setMode(nextMode)
    void handleConfirmTraining(file, nextMode, 0)
    event.target.value = ''
  }

  async function handleConfirmTraining(blob = recorder.recordingBlob, itemMode = mode, durationMs = recorder.elapsedMs) {
    if (!blob || isSaving) return
    const accessState = getUserDataAccessState()
    if (!accessState.allowed) {
      window.alert(accessState.message)
      return
    }

    setIsSaving(true)

    try {
      const mediaSequence = materialItems.length + 1
      const mediaState = await saveTrainingMediaForActiveStorage(
        trainingSessionId,
        blob,
        itemMode,
        trainingDraft.title || `${itemMode === 'video' ? '录像' : '录音'}训练`,
        mediaSequence,
      )
      if (!mediaState) return

      const nextMaterialItem = createMaterialItem(blob, itemMode, durationMs, trainingSessionId, mediaState)
      const nextMaterialItems = [
        ...materialItems,
        nextMaterialItem,
      ]
      const savedDraft = createTrainingDraftFromMaterials(nextMaterialItems, {
        matchId,
        note: trainingDraft.note,
        reviewId,
        title: trainingDraft.title,
        trainingId: trainingSessionId,
      })
      let savedTraining = null
      if (matchId) {
        savedTraining = saveTrainingForMatch(matchId, savedDraft)
      } else {
        savedTraining = saveTraining(savedDraft)
      }
      await syncTrainingToLocalLibrary(savedTraining)
      if (!savedTraining) return

      track(ANALYTICS_EVENTS.TRAINING_SAVED, {
        durationMs: savedTraining.durationMs,
        matchId: savedTraining.matchId,
        mediaType: savedTraining.mode,
        reviewId: savedTraining.reviewId,
        source: 'media_added',
        success: true,
        trainingId: savedTraining.id,
      })
      appendMaterialItem(nextMaterialItem)
      if (blob === recorder.recordingBlob) {
        handleDiscardRecording()
      }
      showSaveNotice('已自动保存')
    } catch {
      window.alert('保存失败，请检查浏览器本地存储权限')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveMaterial(materialId) {
    const removingItem = materialItems.find((item) => item.id === materialId)
    if (!removingItem) return

    const nextItems = materialItems.filter((item) => item.id !== materialId)
    if (removingItem?.trainingId) {
      await deleteTrainingMediaForActiveStorage(removingItem)
    }

    URL.revokeObjectURL(removingItem.previewUrl)
    materialUrlsRef.current = materialUrlsRef.current.filter((url) => url !== removingItem.previewUrl)
    setMaterialItems(nextItems)

    if (removingItem.trainingId) {
      if (nextItems.length === 0) {
        const removingTraining = createTrainingDraftFromMaterials([removingItem], {
          matchId,
          note: trainingDraft.note,
          reviewId,
          title: trainingDraft.title,
          trainingId: removingItem.trainingId,
        })
        deleteTraining(removingItem.trainingId, removingTraining)
      } else {
        void persistSavedTrainingItems(nextItems, { notice: '已自动保存' })
      }
    }
  }

  function handleManualSaveTrainingItems() {
    const savedItems = materialItems.filter((item) => item.trainingId)
    if (savedItems.length === 0) {
      showSaveNotice('右侧暂无训练记录')
      return
    }

    void persistSavedTrainingItems(savedItems, { notice: '已手动保存', trackSave: true })
  }

  return (
    <ContentLayout>
      <WorkbenchHeader
        eyebrow={`训练 / 编辑 / ${modeLabel}`}
        hero="training-create"
        title={trainingDraft.title || '训练档案'}
        meta={`${trainingDraft.teams} · ${trainingDraft.event} · ${trainingDraft.date}`}
        variant="compact"
      />

      <Link className="back-link training-back-link" to="/trainings"><ArrowLeft size={19} />返回列表</Link>

      <section className="practice-grid">
        <div className="practice-main">
          <article className="match-context-card training-draft-card">
            <label className="training-title-field" htmlFor="training-title">
              <span>训练标题</span>
              <input
                className="handdrawn-input-underline"
                id="training-title"
                onChange={(event) => updateTrainingDraft('title', event.target.value)}
                placeholder="输入训练标题"
                value={trainingDraft.title}
              />
            </label>
            <div className="training-draft-meta">
              <span>{trainingDraft.teams}</span>
              <span>{trainingDraft.event}</span>
              <span>{trainingDraft.date}</span>
              <span>参考时长 {trainingDraft.duration}</span>
            </div>
          </article>

          <div className="mode-row">
            <span>训练模式：</span>
            <SketchButton
              active={mode === 'audio'}
              className="mode-button"
              disabled={isRecordingLocked}
              handdrawnFill={{ fill: '#f8e44e' }}
              onClick={() => handleModeChange('audio')}
              type="button"
              variant="secondary"
            >
              录音训练
            </SketchButton>
            <SketchButton
              active={mode === 'video'}
              className="mode-button"
              disabled={isRecordingLocked}
              handdrawnFill={{ fill: '#d7f6c8' }}
              onClick={() => handleModeChange('video')}
              type="button"
              variant="secondary"
            >
              录像训练
            </SketchButton>
          </div>

          <section className="recording-workspace">
            <article className="recorder-card">
              <h2>{getRecorderTitle(recorder.status, modeLabel)}</h2>
              <div className="recording-line">
                <span className={getRecordDotClassName(recorder.status)} />
                <strong>{formatElapsedTime(recorder.elapsedMs)}</strong>
                <Waveform active={recorder.status === 'recording'} levels={recorder.waveformLevels} />
              </div>
              {mode === 'video' && recorder.liveStream ? (
                <video className="recording-video" ref={liveVideoRef} autoPlay muted playsInline />
              ) : null}
              {recorder.previewUrl ? (
                <div className="recording-preview recording-preview--left">
                  {mode === 'video'
                    ? <video src={recorder.previewUrl} controls />
                    : <TrainingAudioPlayer id="current-recording-preview" onPlay={setActiveAudioId} playingId={activeAudioId} src={recorder.previewUrl} />}
                </div>
              ) : null}
              {getRecorderHint(recorder.status) ? <p className="recording-hint">{getRecorderHint(recorder.status)}</p> : null}
              {recorder.error ? <p className="recording-error">{recorder.error}</p> : null}
              <div className="recorder-actions">
                {recorder.status === 'recording' ? (
                  <SketchButton className="training-control-button" onClick={recorder.pause} variant="secondary"><Pause size={18} />暂停</SketchButton>
                ) : null}
                {recorder.status === 'paused' ? (
                  <SketchButton className="training-control-button" onClick={recorder.resume} variant="secondary"><Play size={18} />继续</SketchButton>
                ) : null}
                {recorder.status === 'recording' || recorder.status === 'paused' ? (
                  <SketchButton
                    active
                    className="training-control-button"
                    handdrawnFill={{ fill: '#f06aa8' }}
                    onClick={handleStopRecording}
                    variant="secondary"
                  >
                    <Square size={16} />停止录制
                  </SketchButton>
                ) : null}
                {recorder.status === 'idle' || recorder.status === 'error' ? (
                  <SketchButton
                    active
                    handdrawnFill={{ fill: '#f8e44e' }}
                    onClick={handleStartRecording}
                    variant="secondary"
                  >
                    开始{modeLabel}
                  </SketchButton>
                ) : null}
                {recorder.status === 'ready' ? (
                  <>
                    <SketchButton
                      active
                      className="training-control-button"
                      disabled={isSaving}
                      handdrawnFill={{ fill: '#f8e44e' }}
                      onClick={() => handleConfirmTraining()}
                      variant="secondary"
                    >
                      <Save size={18} />加入训练记录
                    </SketchButton>
                    <SketchButton className="training-control-button" onClick={handleStartRecording} variant="secondary"><RotateCcw size={18} />重新{modeLabel}</SketchButton>
                  </>
                ) : null}
                {recorder.status !== 'idle' && recorder.status !== 'processing' ? (
                  <SketchButton onClick={handleDiscardRecording} variant="secondary">取消</SketchButton>
                ) : null}
              </div>
            </article>

            <aside className="training-save-panel">
              <div className="training-save-panel__head">
                <h2>
                  <button
                    aria-label="手动保存训练"
                    className="training-save-manual-button"
                    onClick={handleManualSaveTrainingItems}
                    title="手动保存训练"
                    type="button"
                  >
                    <img alt="" className="training-save-panel__icon" src={imageAssets.training.save} />
                  </button>
                  <span className="training-save-panel__arrow">↙</span>
                  <span>训练保存</span>
                </h2>
                <SketchButton
                  aria-label="导入素材"
                  className="training-icon-button"
                  onClick={handleImportClick}
                  title="导入素材"
                  variant="secondary"
                >
                  <Upload size={18} />
                </SketchButton>
              </div>
              <p>右侧出现的素材会自动保存；也可以点击左上角图标手动保存。</p>
              {saveNotice ? <p className="training-save-panel__notice">{saveNotice}</p> : null}
              <input
                accept="audio/*,video/*"
                className="training-media-input"
                onChange={handleImportFile}
                ref={fileInputRef}
                type="file"
              />
              {materialItems.length > 0 ? (
                <div className="training-material-list">
                  {materialItems.map((item, index) => (
                    <article className="training-material-item" key={item.id}>
                      <div className="training-material-item__head">
                        <strong>{item.mode === 'video' ? '录像' : '录音'} {index + 1}</strong>
                        <SketchButton
                          aria-label="删除这条训练"
                          className="training-icon-button"
                          onClick={() => handleRemoveMaterial(item.id)}
                          title="删除这条训练"
                          variant="secondary"
                        >
                          <X size={17} />
                        </SketchButton>
                      </div>
                      <div className="recording-preview">
                        {item.mode === 'video'
                          ? <video src={item.previewUrl} controls />
                          : <TrainingAudioPlayer id={item.id} onPlay={setActiveAudioId} playingId={activeAudioId} src={item.previewUrl} />}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="recording-empty-preview">暂无训练素材</div>
              )}
            </aside>
          </section>
        </div>

      </section>

      <section className="hint-card training-note-card training-note-card--wide">
        <h2><MessageSquareText size={20} />训练批注</h2>
        <textarea
          className="training-note-textarea"
          id="training-note"
          onChange={(event) => updateTrainingDraft('note', event.target.value)}
          placeholder="在这里写训练批注..."
          value={trainingDraft.note}
        />
      </section>
    </ContentLayout>
  )
}

function Waveform({ active, levels }) {
  const bars = levels?.length ? levels : [18, 26, 34, 24, 42, 54, 32, 22, 20, 48, 66, 44, 28, 20, 36, 58, 72, 40, 30, 52, 64, 38, 28, 22, 18, 16, 28, 40, 26]

  return (
    <div className="waveform" aria-hidden="true">
      {bars.map((height, index) => (
        <i className={active ? 'wave-bar wave-bar--active' : 'wave-bar'} style={{ height }} key={`${index}-${height}`} />
      ))}
    </div>
  )
}

function TrainingAudioPlayer({ id, onPlay, playingId, src }) {
  const audioRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined

    function updateCurrentTime() {
      setCurrentTime(audio.currentTime)
    }

    function updateDuration() {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }

    function handleEnded() {
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', updateCurrentTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('durationchange', updateDuration)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateCurrentTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('durationchange', updateDuration)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [src])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || playingId === id) return

    audio.pause()
    setIsPlaying(false)
  }, [id, playingId])

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }

    onPlay(id)
    await audio.play()
    setIsPlaying(true)
  }

  function handleTrackClick(event) {
    const audio = audioRef.current
    if (!audio || duration <= 0) return

    const rect = event.currentTarget.getBoundingClientRect()
    const nextProgress = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    audio.currentTime = nextProgress * duration
    setCurrentTime(audio.currentTime)
  }

  return (
    <div className="training-audio-player">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button className="training-audio-player__button" onClick={togglePlayback} type="button" aria-label={isPlaying ? '暂停音频' : '播放音频'}>
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <span className="training-audio-player__time">{formatAudioTime(currentTime)} / {formatAudioTime(duration)}</span>
      <button className="training-audio-player__track" onClick={handleTrackClick} type="button" aria-label="调整播放进度">
        <span className="training-audio-player__fill" style={{ width: `${progress * 100}%` }} />
        <span className="training-audio-player__thumb" style={{ left: `${progress * 100}%` }} />
      </button>
    </div>
  )
}

function formatAudioTime(value) {
  if (!Number.isFinite(value)) return '0:00'

  const totalSeconds = Math.floor(value)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function createMaterialItem(blob, itemMode, durationMs = 0, trainingId = '', fileState = {}) {
  return {
    id: createId('material'),
    blob,
    durationMs,
    folderPath: fileState.folderPath ?? '',
    mediaId: fileState.mediaId ?? '',
    mediaPath: fileState.mediaPath ?? '',
    metaPath: fileState.metaPath ?? '',
    mode: itemMode,
    notePath: fileState.notePath ?? '',
    previewUrl: URL.createObjectURL(blob),
    trainingId,
  }
}

function createTrainingDraftFromMaterials(items, { matchId, note, reviewId, title, trainingId }) {
  const firstItem = items[0]
  if (!firstItem) return null

  const mediaItems = items.flatMap(createTrainingMediaItems)
  const hasVideo = items.some((item) => item.mode === 'video')
  const totalDurationMs = items.reduce((sum, item) => sum + (item.durationMs || 0), 0)

  return {
    id: trainingId,
    durationMs: totalDurationMs,
    folderPath: firstItem.folderPath,
    matchId,
    mediaId: firstItem.mediaId || firstItem.trainingId,
    mediaItems,
    mediaPath: firstItem.mediaPath,
    mediaType: firstItem.blob.type,
    metaPath: firstItem.metaPath,
    mode: hasVideo ? 'video' : 'audio',
    note,
    notePath: firstItem.notePath,
    reviewId,
    title: title || `${hasVideo ? '录像' : '录音'}训练`,
  }
}

function createTrainingMediaItems(item) {
  if (!item.mediaPath && !item.mediaId) return []

  return [
    {
      id: item.mediaId || item.trainingId,
      path: item.mediaPath || '',
      type: item.mode === 'video' ? 'video' : 'audio',
      mimeType: item.blob.type,
      durationMs: item.durationMs,
    },
  ]
}

function getSavedTrainingMediaItems(training) {
  if (Array.isArray(training.mediaItems) && training.mediaItems.length > 0) {
    return training.mediaItems.map((item) => ({
      durationMs: item.durationMs ?? 0,
      id: item.id || training.mediaId || training.id,
      mimeType: item.mimeType || training.mediaType || '',
      path: item.path || training.mediaPath || '',
      type: item.type || training.mode || 'audio',
    }))
  }

  if (!training.mediaId && !training.mediaPath) return []

  return [
    {
      durationMs: training.durationMs ?? 0,
      id: training.mediaId || training.id,
      mimeType: training.mediaType || '',
      path: training.mediaPath || '',
      type: training.mode || 'audio',
    },
  ]
}

function getRecorderTitle(status, modeLabel) {
  if (status === 'recording') return `正在${modeLabel}`
  if (status === 'paused') return `${modeLabel}已暂停`
  if (status === 'processing') return '正在整理录制内容'
  if (status === 'ready') return `${modeLabel}完成`
  return `准备${modeLabel}`
}

function getRecorderHint(status) {
  if (status === 'recording') return ''
  if (status === 'paused') return ''
  if (status === 'processing') return '正在生成预览，请稍等。'
  if (status === 'ready') return ''
  return ''
}

function getRecordDotClassName(status) {
  if (status === 'recording') return 'record-dot'
  if (status === 'ready') return 'record-dot record-dot--ready'
  return 'record-dot record-dot--idle'
}

function formatElapsedTime(elapsedMs) {
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}
