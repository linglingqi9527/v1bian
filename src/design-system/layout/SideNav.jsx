import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { imageAssets } from '../../assets/assetPaths.js'
import { AUTH_UPDATED_EVENT, isDemoUserLoggedIn } from '../../features/auth/authService.js'
import { REVIEWS_UPDATED_EVENT, listReviews } from '../../features/reviews/reviewService.js'
import { REVIEW_PRIORITY_OPTIONS, REVIEW_STATUS } from '../../features/reviews/reviewUtils.js'
import { LOCAL_LIBRARY_UPDATED_EVENT } from '../../features/storage/localLibraryService.js'
import { TRAININGS_UPDATED_EVENT, listTrainings, listTrainingsByReviewId } from '../../features/trainings/trainingService.js'
import { HandDrawnSelectionFill } from '../handdrawn/HandDrawnSelectionFill.jsx'

const navItems = [
  { to: '/matches', label: '看比赛', icon: imageAssets.nav.watchMatch, kind: 'watch' },
  { to: '/reviews', label: '写赛评', icon: imageAssets.nav.writeReview, kind: 'review' },
  { to: '/trainings', label: '做训练', icon: imageAssets.nav.startTraining, kind: 'train' },
]

export function SideNav() {
  const { pathname } = useLocation()
  const [, refreshStatsPanels] = useState(0)
  const [loggedIn, setLoggedIn] = useState(() => isDemoUserLoggedIn())
  const section = pathname.startsWith('/reviews')
    ? 'reviews'
    : pathname.startsWith('/trainings')
      ? 'trainings'
      : 'matches'

  function handleAuthUpdated() {
    setLoggedIn(isDemoUserLoggedIn())
  }

  useEffect(() => {
    function handleReviewsUpdated() {
      refreshStatsPanels((value) => value + 1)
    }

    window.addEventListener(REVIEWS_UPDATED_EVENT, handleReviewsUpdated)
    window.addEventListener(TRAININGS_UPDATED_EVENT, handleReviewsUpdated)
    window.addEventListener(AUTH_UPDATED_EVENT, handleReviewsUpdated)
    window.addEventListener(AUTH_UPDATED_EVENT, handleAuthUpdated)
    window.addEventListener(LOCAL_LIBRARY_UPDATED_EVENT, handleReviewsUpdated)
    return () => {
      window.removeEventListener(REVIEWS_UPDATED_EVENT, handleReviewsUpdated)
      window.removeEventListener(TRAININGS_UPDATED_EVENT, handleReviewsUpdated)
      window.removeEventListener(AUTH_UPDATED_EVENT, handleReviewsUpdated)
      window.removeEventListener(AUTH_UPDATED_EVENT, handleAuthUpdated)
      window.removeEventListener(LOCAL_LIBRARY_UPDATED_EVENT, handleReviewsUpdated)
    }
  }, [])

  return (
    <aside className="side-nav">
      <div className="brand-lockup">
        <img src={imageAssets.logoMark} alt="辩了么" />
        <div>
          <strong>辩了么</strong>
          <span>bian le me</span>
        </div>
      </div>
      <nav className="primary-nav" aria-label="主导航">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {({ isActive }) => (
              <>
                {isActive ? (
                  <HandDrawnSelectionFill preset="navActiveFill" shape="pill" />
                ) : null}
                <span className="primary-nav__icon" data-nav-icon={item.kind}>
                  <img src={item.icon} alt="" />
                </span>
                <span className="primary-nav__label">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="nav-divider" />
      {section === 'matches' ? <MatchesPanel /> : null}
      {section === 'reviews' ? <ReviewsPanel /> : null}
      {section === 'trainings' ? <TrainingsPanel /> : null}
      <NavLink className="settings-link" to="/profile">
        {({ isActive }) => (
          <>
            {isActive ? (
              <HandDrawnSelectionFill preset="navActiveFill" shape="pill" />
            ) : null}
            <span>⚙</span>
            <span>{loggedIn ? '已登录' : '登录'}</span>
          </>
        )}
      </NavLink>
    </aside>
  )
}

function MatchesPanel() {
  return (
    <>
      <section className="nav-section">
        <h2>我的赛事</h2>
        <SmallCard title="2026bilibili新国辩 高校组 初赛H组第三场" meta="2026-06-04  13:01" />
        <SmallCard title="2025bilibili新国辩 高校组 半决赛上半赛区" meta="草稿" />
      </section>
      <section className="nav-section">
        <h2>当前关联</h2>
        <SmallCard title="2026bilibili新国辩 高校组 初赛H组第三场" meta="3 次训练" />
      </section>
    </>
  )
}

function ReviewsPanel() {
  const reviews = listReviews()
  const completedCount = reviews.filter((review) => review.status === REVIEW_STATUS.completed).length
  const draftCount = reviews.filter((review) => review.status === REVIEW_STATUS.draft).length
  const trainedCount = reviews.filter((review) => listTrainingsByReviewId(review.id).length > 0).length

  return (
    <>
      <section className="nav-section nav-section--underlined stat-list">
        <h2 className="handdrawn-underline handdrawn-underline--nav-section">我的赛评</h2>
        <StatLine label="全部赛评" to="/reviews" tone="blue" value={reviews.length} />
        <StatLine label="已完成" tone="blue" value={completedCount} />
        <StatLine label="草稿" tone="pink" value={draftCount} />
        <StatLine label="已训练" tone="green" value={trainedCount} />
      </section>
      <section className="nav-section nav-section--underlined stat-list">
        <h2 className="handdrawn-underline handdrawn-underline--nav-section">自定义重点 <span>＋</span></h2>
        {REVIEW_PRIORITY_OPTIONS.map((option) => (
          <StatLine
            label={getPriorityLabel(option.value)}
            to={`/reviews?priority=${option.value}`}
            tone={option.value}
            value={reviews.filter((review) => review.priority === option.value).length}
            key={option.value}
          />
        ))}
      </section>
    </>
  )
}

function TrainingsPanel() {
  const trainings = listTrainings()
  const audioCount = trainings.filter((training) => training.mode === 'audio').length
  const videoCount = trainings.filter((training) => training.mode === 'video').length
  const thisWeekCount = trainings.filter(isCreatedThisWeek).length

  return (
    <>
      <section className="nav-section nav-section--underlined stat-list">
        <h2 className="handdrawn-underline handdrawn-underline--nav-section">我的训练</h2>
        <StatLine label="全部训练" to="/trainings" tone="blue" value={trainings.length} />
        <StatLine label="录音训练" tone="blue" value={audioCount} />
        <StatLine label="录像训练" tone="green" value={videoCount} />
        <StatLine label="本周训练" tone="pink" value={thisWeekCount} />
      </section>
      <section className="nav-section nav-section--underlined stat-list">
        <h2 className="handdrawn-underline handdrawn-underline--nav-section">自定义重点 <span>＋</span></h2>
        {REVIEW_PRIORITY_OPTIONS.map((option) => (
          <StatLine
            label={getPriorityLabel(option.value)}
            to={`/trainings?priority=${option.value}`}
            tone={option.value}
            value={trainings.filter((training) => training.priority === option.value).length}
            key={option.value}
          />
        ))}
      </section>
    </>
  )
}

function SmallCard({ meta, title }) {
  return (
    <div className="nav-mini-card">
      <strong>{title}</strong>
      <span>{meta}</span>
      <b>›</b>
    </div>
  )
}

function StatLine({ label, tone = 'black', to, value }) {
  const content = (
    <>
      <i className={`dot dot--${tone}`} />
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  )

  return to ? (
    <NavLink className="stat-line stat-line--link" to={to}>
      {content}
    </NavLink>
  ) : (
    <div className="stat-line">
      {content}
    </div>
  )
}

function getPriorityLabel(priority) {
  if (priority === 'red') return '最高级重点'
  if (priority === 'black') return '第二级重点'
  if (priority === 'purple') return '第三级重点'
  return '普通重点'
}

function isCreatedThisWeek(item) {
  const createdAt = new Date(item.createdAt)
  if (Number.isNaN(createdAt.getTime())) return false

  const now = new Date()
  const startOfWeek = new Date(now)
  const day = now.getDay() || 7
  startOfWeek.setHours(0, 0, 0, 0)
  startOfWeek.setDate(now.getDate() - day + 1)

  return createdAt >= startOfWeek
}
