import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, MessageSquareText, Pause, Play, RotateCcw, Save, Square, Upload, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { WorkbenchHeader } from '../design-system/layout/WorkbenchHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { imageAssets } from '../assets/assetPaths.js'
import { deleteTrainingMedia, saveTrainingMedia } from '../features/trainings/trainingMediaStore.js'
import { deleteTraining, saveTraining, saveTrainingForMatch } from '../features/trainings/trainingService.js'
import { useTrainingRecorder } from '../features/trainings/useTrainingRecorder.js'
import { createId } from '../utils/ids.js'
import '../features/trainings/components/TrainingCreateLayout.css'

export default function TrainingCreatePage() {
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState('audio')
  const [isSaving, setIsSaving] = useState(false)
  const [materialItems, setMaterialItems] = useState([])
  const [activeAudioId, setActiveAudioId] = useState('')
  const fileInputRef = useRef(null)
  const liveVideoRef = useRef(null)
  const materialUrlsRef = useRef([])
  const recorder = useTrainingRecorder(mode)
  const modeLabel = mode === 'video' ? '录像' : '录音'
  const isRecordingLocked = recorder.status === 'recording' || recorder.status === 'paused' || recorder.status === 'processing'
  const [trainingDraft, setTrainingDraft] = useState({
    date: '2026-01-24',
    duration: '02:07:09',
    event: '新国辩半决赛',
    note: '控制语速，首段立场要明确，结尾注意收束。',
    teams: '香港大学 vs 北京师范大学',
    title: 'AI的迅猛发展提升了 / 降低了人类创作者存在的意义',
  })

  useEffect(() => {
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = recorder.liveStream
    }
  }, [recorder.liveStream])

  const appendMaterialItem = useCallback((blob, itemMode, durationMs = 0, trainingId = '') => {
    const previewUrl = URL.createObjectURL(blob)
    materialUrlsRef.current.push(previewUrl)
    setMaterialItems((current) => [
      ...current,
      {
        id: createId('material'),
        blob,
        durationMs,
        mode: itemMode,
        previewUrl,
        trainingId,
      },
    ])
  }, [])

  useEffect(() => () => {
    materialUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

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

  function handleStartRecording() {
    recorder.start()
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

    const trainingId = createId('training')
    const matchId = searchParams.get('matchId') || ''
    const reviewId = searchParams.get('reviewId') || ''
    const savedDraft = {
      id: trainingId,
      durationMs,
      matchId,
      mediaId: trainingId,
      mediaType: blob.type,
      mode: itemMode,
      note: trainingDraft.note,
      reviewId,
      title: trainingDraft.title || `${itemMode === 'video' ? '录像' : '录音'}训练`,
    }

    setIsSaving(true)

    try {
      await saveTrainingMedia(trainingId, blob)
      if (matchId) {
        saveTrainingForMatch(matchId, savedDraft)
      } else {
        saveTraining(savedDraft)
      }
      appendMaterialItem(blob, itemMode, durationMs, trainingId)
      if (blob === recorder.recordingBlob) {
        handleDiscardRecording()
      }
    } catch {
      window.alert('保存失败，请检查浏览器本地存储权限')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemoveMaterial(materialId) {
    const removingItem = materialItems.find((item) => item.id === materialId)
    if (removingItem?.trainingId) {
      deleteTraining(removingItem.trainingId)
      await deleteTrainingMedia(removingItem.trainingId)
    }

    setMaterialItems((current) => {
      const removingItem = current.find((item) => item.id === materialId)
      if (removingItem) {
        URL.revokeObjectURL(removingItem.previewUrl)
        materialUrlsRef.current = materialUrlsRef.current.filter((url) => url !== removingItem.previewUrl)
      }
      return current.filter((item) => item.id !== materialId)
    })
  }

  return (
    <ContentLayout>
      <WorkbenchHeader
        eyebrow="新国辩数据库 / 训练 / AI 的迅猛发展提升了 / 降低了人类创作者存在的意义"
        hero="training-create"
        title="训练档案"
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
                    onClick={recorder.stop}
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
                <h2><img alt="" className="training-save-panel__icon" src={imageAssets.training.save} />训练保存</h2>
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
              <p>可以连续录制，也可以导入已有音频或视频。</p>
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
