import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { imageAssets } from '../../assets/assetPaths.js'
import { getSideNavActivity } from '../../features/activity/sideNavActivityService.js'
import { AUTH_UPDATED_EVENT, isUserLoggedIn } from '../../features/auth/authService.js'
import { JUDGE_UPDATED_EVENT, listJudgeConversations } from '../../features/judge/judgeService.js'
import { MATCHES_UPDATED_EVENT } from '../../features/matches/matchService.js'
import { REVIEWS_UPDATED_EVENT, listReviews } from '../../features/reviews/reviewService.js'
import { REVIEW_PRIORITY_OPTIONS, REVIEW_STATUS } from '../../features/reviews/reviewUtils.js'
import { LOCAL_LIBRARY_UPDATED_EVENT } from '../../features/storage/localLibraryService.js'
import { getUserDataAccessState } from '../../features/storage/userDataAccess.js'
import { TRAININGS_UPDATED_EVENT, listTrainings, listTrainingsByReviewId } from '../../features/trainings/trainingService.js'
import { HandDrawnSelectionFill } from '../handdrawn/HandDrawnSelectionFill.jsx'

const navItems = [
  { to: '/matches', label: '看比赛', icon: imageAssets.nav.watchMatch, kind: 'watch' },
  { to: '/reviews', label: '写赛评', icon: imageAssets.nav.writeReview, kind: 'review' },
  { to: '/trainings', label: '做训练', icon: imageAssets.nav.startTraining, kind: 'train' },
  { to: '/judge', label: 'Judge', icon: imageAssets.nav.judge, kind: 'judge' },
]

export function SideNav() {
  const { pathname } = useLocation()
  const [, refreshStatsPanels] = useState(0)
  const [loggedIn, setLoggedIn] = useState(() => isUserLoggedIn())
  const section = pathname.startsWith('/judge')
    ? 'judge'
    : pathname.startsWith('/reviews')
    ? 'reviews'
    : pathname.startsWith('/trainings')
      ? 'trainings'
      : 'matches'

  function handleAuthUpdated() {
    setLoggedIn(isUserLoggedIn())
  }

  useEffect(() => {
    function handleReviewsUpdated() {
      refreshStatsPanels((value) => value + 1)
    }

    window.addEventListener(REVIEWS_UPDATED_EVENT, handleReviewsUpdated)
    window.addEventListener(TRAININGS_UPDATED_EVENT, handleReviewsUpdated)
    window.addEventListener(MATCHES_UPDATED_EVENT, handleReviewsUpdated)
    window.addEventListener(JUDGE_UPDATED_EVENT, handleReviewsUpdated)
    window.addEventListener(AUTH_UPDATED_EVENT, handleReviewsUpdated)
    window.addEventListener(AUTH_UPDATED_EVENT, handleAuthUpdated)
    window.addEventListener(LOCAL_LIBRARY_UPDATED_EVENT, handleReviewsUpdated)
    return () => {
      window.removeEventListener(REVIEWS_UPDATED_EVENT, handleReviewsUpdated)
      window.removeEventListener(TRAININGS_UPDATED_EVENT, handleReviewsUpdated)
      window.removeEventListener(MATCHES_UPDATED_EVENT, handleReviewsUpdated)
      window.removeEventListener(JUDGE_UPDATED_EVENT, handleReviewsUpdated)
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
      {section === 'judge' ? <JudgePanel /> : null}
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

function JudgePanel() {
  const conversations = listJudgeConversations()
  const matchCount = conversations.filter((conversation) => conversation.contextType === 'match').length
  const reviewCount = conversations.filter((conversation) => conversation.contextType === 'review').length
  const trainingCount = conversations.filter((conversation) => conversation.contextType === 'training').length

  return (
    <section className="nav-section nav-section--underlined stat-list">
      <h2 className="handdrawn-underline handdrawn-underline--nav-section">Judge 记录</h2>
      <StatLine label="全部会话" to="/judge" tone="blue" value={conversations.length} />
      <StatLine label="比赛判读" tone="yellow" value={matchCount} />
      <StatLine label="赛评辅助" tone="pink" value={reviewCount} />
      <StatLine label="训练建议" tone="green" value={trainingCount} />
    </section>
  )
}

function MatchesPanel() {
  const { currentItems, myMatches } = getSideNavActivity()
  const accessState = getUserDataAccessState()
  const emptyHint = getMatchesPanelEmptyHint(accessState.mode)

  return (
    <>
      <section className="nav-section">
        <h2>我的赛事</h2>
        {myMatches.length > 0
          ? myMatches.map((item) => <SmallCard {...item} key={item.id} />)
          : <p className="nav-empty-hint">{emptyHint.myMatches}</p>}
      </section>
      <section className="nav-section">
        <h2>当前关联</h2>
        {currentItems.length > 0
          ? currentItems.map((item) => <SmallCard {...item} key={item.id} />)
          : <p className="nav-empty-hint">{emptyHint.currentItems}</p>}
      </section>
    </>
  )
}

function getMatchesPanelEmptyHint(accessMode) {
  if (accessMode === 'guest') {
    return {
      currentItems: '登录后会显示正在编辑的赛评和训练',
      myMatches: '登录后会显示最近观看或写过赛评的比赛',
    }
  }

  if (accessMode === 'local-without-library') {
    return {
      currentItems: '连接资料包后会显示正在编辑的赛评和训练',
      myMatches: '连接资料包后会显示最近观看或写过赛评的比赛',
    }
  }

  return {
    currentItems: '暂时没有正在进行的赛评或训练',
    myMatches: '还没有最近观看或写过赛评的比赛',
  }
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

function SmallCard({ meta, title, to }) {
  return (
    <NavLink className="nav-mini-card" to={to}>
      <strong>{title}</strong>
      <span>{meta}</span>
      <b>›</b>
    </NavLink>
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
