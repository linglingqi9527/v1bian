import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { imageAssets } from '../assets/assetPaths.js'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { WorkbenchHeader } from '../design-system/layout/WorkbenchHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { SketchCard } from '../design-system/ui/SketchCard.jsx'
import { SketchInput } from '../design-system/ui/SketchInput.jsx'
import { ReviewRichTextEditor } from '../features/editor/components/ReviewRichTextEditor.jsx'
import { getMatchById } from '../features/matches/matchService.js'
import { formatMatchTeams } from '../features/matches/matchUtils.js'
import { getReviewById, getReviewByMatchId, saveReview, saveReviewForMatch } from '../features/reviews/reviewService.js'
import {
  REVIEW_STATUS,
  formatReviewMatchInfo,
  getDefaultReviewTitle,
  getReviewContentText,
  getReviewEditorInitialState,
  getReviewMatchSnapshot,
  validateReviewSave,
} from '../features/reviews/reviewUtils.js'

const AUTO_SAVE_DELAY_MS = 1200
const SAVE_FEEDBACK_MS = 2200

export default function ReviewEditorPage() {
  const { matchId, reviewId } = useParams()
  const navigate = useNavigate()
  const routeReview = reviewId ? getReviewById(reviewId) : null
  const routeMatchId = matchId ?? routeReview?.matchId
  const existingMatchReview = routeMatchId ? getReviewByMatchId(routeMatchId) : null
  const review = routeReview ?? existingMatchReview
  const match = getMatchById(routeMatchId)
  const matchInfo = formatReviewMatchInfo(match, formatMatchTeams)

  return (
    <ReviewEditorWorkspace
      initialState={getReviewEditorInitialState(review, match)}
      initialMatchSnapshot={getReviewMatchSnapshot(review, matchInfo)}
      match={match}
      matchInfo={matchInfo}
      review={review}
      routeMatchId={routeMatchId}
      onCreatePrivateReview={(createdReviewId) => navigate(`/reviews/${createdReviewId}/edit`, { replace: true })}
      key={review?.id ?? routeMatchId ?? 'new-review-editor'}
    />
  )
}

function ReviewEditorWorkspace({ initialMatchSnapshot, initialState, match, onCreatePrivateReview, review, routeMatchId }) {
  const initialManualSavedAt = review?.manualSavedAt ?? ''
  const [contentHtml, setContentHtml] = useState(initialState.content)
  const [contentText, setContentText] = useState(() => getReviewContentText(initialState.content))
  const [autoSaveState, setAutoSaveState] = useState('idle')
  const [editorNotice, setEditorNotice] = useState('')
  const [editorError, setEditorError] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastManualSavedAt, setLastManualSavedAt] = useState(initialManualSavedAt)
  const [matchSnapshot, setMatchSnapshot] = useState(initialMatchSnapshot)
  const [savedReviewId, setSavedReviewId] = useState(review?.id ?? null)
  const [status, setStatus] = useState(initialState.status)
  const [title, setTitle] = useState(initialState.title)

  const handleContentChange = useCallback((snapshot, meta) => {
    setContentHtml(snapshot.html)
    setContentText(snapshot.text)
    if (!meta?.initial) setHasUnsavedChanges(true)
  }, [])

  const persistReview = useCallback(({ manual = false, nextStatus = status } = {}) => {
    const targetMatchId = routeMatchId
    const finalTitle = title.trim() || getDefaultReviewTitle(match)
    const manualSavedAt = manual ? new Date().toISOString() : lastManualSavedAt
    const reviewDraft = {
      id: savedReviewId ?? review?.id,
      content: contentHtml,
      matchSnapshot,
      manualSavedAt,
      status: nextStatus,
      title: finalTitle,
    }
    const savedReview = targetMatchId
      ? saveReviewForMatch(targetMatchId, reviewDraft)
      : saveReview(reviewDraft)

    setEditorError('')
    setHasUnsavedChanges(false)
    setLastManualSavedAt(savedReview.manualSavedAt)
    setMatchSnapshot(savedReview.matchSnapshot)
    setSavedReviewId(savedReview.id)
    setStatus(savedReview.status)
    setTitle(savedReview.title)
    if (!targetMatchId && !savedReviewId && savedReview.id) {
      onCreatePrivateReview(savedReview.id)
    }

    return savedReview
  }, [contentHtml, lastManualSavedAt, match, matchSnapshot, onCreatePrivateReview, review, routeMatchId, savedReviewId, status, title])

  const handleManualSave = useCallback(() => {
    const savedReview = persistReview({ manual: true })
    if (!savedReview) return

    setEditorNotice('已手动保存')
    window.setTimeout(() => setEditorNotice(''), SAVE_FEEDBACK_MS)
  }, [persistReview])

  function handleTitleChange(event) {
    setTitle(event.target.value)
    setHasUnsavedChanges(true)
    setEditorError('')
  }

  function handleStatusChange(nextStatus) {
    if (nextStatus === status) return

    if (nextStatus === REVIEW_STATUS.completed) {
      const errors = validateReviewSave({
        contentText,
        status: nextStatus,
        title: title.trim(),
      })
      if (errors.length > 0) {
        setEditorError(errors[0])
        return
      }
    }

    setAutoSaveState('saving')
    const savedReview = persistReview({ nextStatus })
    if (savedReview) {
      setAutoSaveState('saved')
      window.setTimeout(() => setAutoSaveState('idle'), SAVE_FEEDBACK_MS)
    } else {
      setAutoSaveState('idle')
    }
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        handleManualSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleManualSave])

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined

    const timeoutId = window.setTimeout(() => {
      setAutoSaveState('saving')
      const savedReview = persistReview()
      setAutoSaveState(savedReview ? 'saved' : 'idle')
      if (savedReview) {
        window.setTimeout(() => setAutoSaveState('idle'), SAVE_FEEDBACK_MS)
      }
    }, AUTO_SAVE_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [hasUnsavedChanges, persistReview])

  return (
    <ContentLayout>
      <WorkbenchHeader
        decoration={false}
        eyebrow="新国辩数据库 / 赛评 / 编辑"
        hero="review-editor"
        title={matchSnapshot.topic || '我的赛评'}
        meta={`${matchSnapshot.teams || '队伍待补'} · ${matchSnapshot.event || '赛事待补'} · ${matchSnapshot.year || '年份待补'}`}
        variant="compact"
      />

      <Link className="back-link" to="/reviews"><ArrowLeft size={18} />返回列表</Link>

      <SketchCard className="review-editor-meta-card">
        <div className="review-editor-form-row">
          <SketchInput
            className="review-title-input handdrawn-input-underline"
            id="review-title"
            label="赛评标题"
            onChange={handleTitleChange}
            placeholder="给这篇赛评起个标题"
            style={{ width: getTitleInputWidth(title) }}
            value={title}
          />
          <div className="review-status-field">
            <span>赛评状态</span>
            <div className="review-status-options">
              {[REVIEW_STATUS.draft, REVIEW_STATUS.completed].map((item) => (
                <SketchButton
                  active={status === item}
                  className={`review-status-button review-status-button--${item === REVIEW_STATUS.draft ? 'draft' : 'completed'}`}
                  handdrawnFill={getReviewStatusFill(item)}
                  onClick={() => handleStatusChange(item)}
                  type="button"
                  variant="secondary"
                  key={item}
                >
                  {item}
                </SketchButton>
              ))}
            </div>
          </div>
        </div>
        <div className="review-save-note" aria-live="polite">
          <SketchButton
            aria-label="手动保存"
            className="review-manual-save-button"
            handdrawnFill={false}
            onClick={handleManualSave}
            title="手动保存"
            type="button"
            variant="secondary"
          >
            <img className="review-manual-save-button__icon" src={imageAssets.training.save} alt="" />
          </SketchButton>
          <span>{lastManualSavedAt ? `上次保存：${formatSavedTime(lastManualSavedAt)}` : '还没有手动保存'}</span>
          {autoSaveState === 'saving' ? <span>自动保存中...</span> : null}
          {autoSaveState === 'saved' ? <span>已自动保存</span> : null}
          {editorNotice ? <strong>{editorNotice}</strong> : null}
          {editorError ? <strong className="review-save-note__error">{editorError}</strong> : null}
        </div>
      </SketchCard>

      <ReviewRichTextEditor
        initialContent={contentHtml}
        onContentChange={handleContentChange}
        reviewId={savedReviewId ?? review?.id}
      />
    </ContentLayout>
  )
}

function getTitleInputWidth(value) {
  const text = String(value ?? '')
  const weightedLength = Array.from(text).reduce((total, character) => {
    return total + (/[\u3400-\u9fff\uff00-\uffef]/.test(character) ? 1.05 : 0.58)
  }, 0)

  return `min(100%, max(75%, ${Math.ceil(weightedLength + 3)}em))`
}

function getReviewStatusFill(status) {
  if (status === REVIEW_STATUS.completed) {
    return { color: '#9dd0ff', opacity: 0.72, variant: 'marker' }
  }

  return { color: '#ffd9e3', opacity: 0.82, variant: 'marker' }
}

function formatSavedTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  })
}
