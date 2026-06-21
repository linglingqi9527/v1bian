import { NavLink, useLocation } from 'react-router'
import { imageAssets } from '../../assets/assetPaths.js'
import { HandDrawnSelectionFill } from '../handdrawn/HandDrawnSelectionFill.jsx'

const navItems = [
  { to: '/matches', label: '看比赛', icon: imageAssets.nav.watchMatch, kind: 'watch' },
  { to: '/reviews', label: '写赛评', icon: imageAssets.nav.writeReview, kind: 'review' },
  { to: '/trainings', label: '做训练', icon: imageAssets.nav.startTraining, kind: 'train' },
]

export function SideNav() {
  const { pathname } = useLocation()
  const section = pathname.startsWith('/reviews')
    ? 'reviews'
    : pathname.startsWith('/trainings')
      ? 'trainings'
      : 'matches'

  return (
    <aside className="side-nav">
      <div className="brand-lockup">
        <img src={imageAssets.logoMark} alt="辩了么" />
        <div>
          <strong>辩论工作台</strong>
          <span>比赛圈圈 OS</span>
        </div>
      </div>
      <nav className="primary-nav" aria-label="主导航">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {({ isActive }) => (
              <>
                {isActive ? (
                  <HandDrawnSelectionFill preset="navActiveFill" shape="pill" stroke="transparent" />
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
              <HandDrawnSelectionFill preset="navActiveFill" shape="pill" stroke="transparent" />
            ) : null}
            <span>⚙</span>
            <span>设置</span>
          </>
        )}
      </NavLink>
      <span className="corner-scribble" aria-hidden="true" />
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
  return (
    <>
      <section className="nav-section stat-list">
        <h2>我的赛评</h2>
        <StatLine label="全部赛评" value="28" />
        <StatLine label="已完成" value="23" />
        <StatLine label="草稿" value="3" />
        <StatLine label="已训练" value="15" />
      </section>
      <section className="nav-section stat-list">
        <h2>自定义重点 <span>＋</span></h2>
        <StatLine label="我的核心赛评" value="8" tone="purple" />
        <StatLine label="教学案例库" value="6" tone="red" />
        <StatLine label="备赛重点" value="4" tone="orange" />
        <StatLine label="复盘对比" value="3" tone="blue" />
      </section>
    </>
  )
}

function TrainingsPanel() {
  return (
    <section className="nav-section stat-list">
      <h2>我的训练</h2>
      <StatLine label="累计训练" value="18次" />
      <StatLine label="录音训练" value="12次" />
      <StatLine label="录像训练" value="6次" />
      <StatLine label="本周训练" value="3次" />
      <StatLine label="最佳时长" value="02:48" />
    </section>
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

function StatLine({ label, tone = 'black', value }) {
  return (
    <div className="stat-line">
      <i className={`dot dot--${tone}`} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
