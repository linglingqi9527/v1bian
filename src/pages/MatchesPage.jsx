import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Search } from 'lucide-react'
import { imageAssets } from '../assets/assetPaths.js'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { WorkbenchHeader } from '../design-system/layout/WorkbenchHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { SketchTag } from '../design-system/ui/SketchTag.jsx'
import { listMatches, markMatchWatched, toggleMatchFavorite } from '../features/matches/matchService.js'
import {
  filterMatches,
  formatMatchSpeakers,
  formatMatchTeams,
  getMatchReviewRoute,
  getMatchStatusTags,
  getMatchTrainingRoute,
  searchMatches,
} from '../features/matches/matchUtils.js'

const FILTERS = ['全部', '已看', '收藏']

export default function MatchesPage() {
  const [matches, setMatches] = useState(() => listMatches())
  const [activeFilter, setActiveFilter] = useState(FILTERS[0])
  const [searchQuery, setSearchQuery] = useState('')
  const visibleMatches = useMemo(
    () => searchMatches(filterMatches(matches, activeFilter), searchQuery),
    [activeFilter, matches, searchQuery],
  )

  function refreshMatches() {
    setMatches(listMatches())
  }

  function handleToggleFavorite(matchId) {
    toggleMatchFavorite(matchId)
    refreshMatches()
  }

  function handleBookmarkKeyDown(event, matchId) {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    handleToggleFavorite(matchId)
  }

  function handleWatchMatch(event, match) {
    event.preventDefault()
    markMatchWatched(match.id)
    refreshMatches()

    if (match.bilibiliUrl) {
      window.open(match.bilibiliUrl, '_blank')
      return
    }

    window.alert('暂无比赛链接')
  }

  return (
    <ContentLayout>
      <WorkbenchHeader
        decoration={false}
        hero="matches"
        title="新国辩索引"
      />

      <section className="match-toolbar">
        <label className="search-box">
          <Search size={28} />
          <input
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索比赛、辩题、学校、辩手..."
            value={searchQuery}
          />
        </label>
        <div className="pill-row">
          {FILTERS.map((item) => (
            <SketchButton
              active={item === activeFilter}
              className="pill"
              handdrawnFill={{ color: '#F7D95C', opacity: 0.46, variant: 'marker' }}
              onClick={() => setActiveFilter(item)}
              type="button"
              variant="secondary"
              key={item}
            >
              {item}
            </SketchButton>
          ))}
        </div>
      </section>

      <section className="match-list">
        {visibleMatches.map((match) => (
          <article className="match-card" key={match.title}>
            <span className={`card-accent card-accent--${match.accent}`} />
            <aside className="match-side">
              <span className="match-side-event">{match.event.replace('bilibili', '')}</span>
              <strong>{match.stage}</strong>
            </aside>
            <div className="match-main">
              <p className="match-school">{formatMatchTeams(match)} · {match.date} · {match.bvId}</p>
              <h2>{match.title}</h2>
              <p className="match-speakers">{formatMatchSpeakers(match)}</p>
              <div className="status-row">
                {getMatchStatusTags(match).map((tag) => (
                  <SketchTag
                    active={tag.active}
                    tone={tag.tone}
                    key={tag.label}
                  >
                    {tag.label}
                  </SketchTag>
                ))}
              </div>
            </div>
            <div className="match-actions">
              <ActionLink
                icon={imageAssets.matchCard.watchVideo}
                label="观看比赛"
                onClick={(event) => handleWatchMatch(event, match)}
                to={`/matches/${match.id}`}
              />
              <ActionLink
                icon={imageAssets.matchCard.writeReview}
                label="打开赛评"
                to={getMatchReviewRoute(match)}
              />
              <ActionLink icon={imageAssets.matchCard.startTraining} label="开始训练" to={getMatchTrainingRoute(match)} />
            </div>
            <span
              aria-label={match.favorite ? '取消收藏比赛' : '收藏比赛'}
              aria-pressed={match.favorite}
              className="bookmark-mark"
              data-favorite={match.favorite ? 'true' : 'false'}
              onClick={() => handleToggleFavorite(match.id)}
              onKeyDown={(event) => handleBookmarkKeyDown(event, match.id)}
              role="button"
              tabIndex={0}
            />
          </article>
        ))}
      </section>
    </ContentLayout>
  )
}

function ActionLink({ icon, label, onClick, to }) {
  return (
    <SketchButton
      active={label === '观看比赛'}
      as={Link}
      className="match-action-link"
      handdrawnFill={{ color: '#F7D95C', opacity: 0.44, variant: 'marker' }}
      icon={<img src={icon} alt="" />}
      onClick={onClick}
      to={to}
      variant="secondary"
    >
      {label}
    </SketchButton>
  )
}
