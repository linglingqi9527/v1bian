import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ANALYTICS_EVENTS, track } from '../features/analytics/index.js'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { WorkbenchHeader } from '../design-system/layout/WorkbenchHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { MatchCard } from '../features/matches/components/MatchCard.jsx'
import { listMatches, markMatchWatched, toggleMatchFavorite, toggleMatchWatched } from '../features/matches/matchService.js'
import {
  filterMatches,
  searchMatches,
} from '../features/matches/matchUtils.js'

const FILTERS = ['全部', '已看', '收藏']
const DEFAULT_MATCH_LIMIT = 15

export default function MatchesPage() {
  const [matches, setMatches] = useState(() => listMatches())
  const [activeFilter, setActiveFilter] = useState(FILTERS[0])
  const [searchQuery, setSearchQuery] = useState('')
  const visibleMatches = useMemo(
    () => searchMatches(filterMatches(matches, activeFilter), searchQuery).slice(0, DEFAULT_MATCH_LIMIT),
    [activeFilter, matches, searchQuery],
  )

  function refreshMatches() {
    setMatches(listMatches())
  }

  function handleToggleFavorite(matchId) {
    const previousMatch = matches.find((match) => match.id === matchId)
    const savedMatch = toggleMatchFavorite(matchId)
    refreshMatches()
    if (!previousMatch || !savedMatch || savedMatch.favorite === previousMatch.favorite) return

    track(ANALYTICS_EVENTS.MATCH_FAVORITE_CHANGED, {
      favorite: savedMatch.favorite,
      matchId,
      success: true,
    })
  }

  function handleToggleWatched(event, matchId) {
    event.stopPropagation()
    const previousMatch = matches.find((match) => match.id === matchId)
    const savedMatch = toggleMatchWatched(matchId)
    refreshMatches()
    if (!previousMatch || !savedMatch || savedMatch.watched === previousMatch.watched) return

    track(ANALYTICS_EVENTS.MATCH_WATCHED_CHANGED, {
      matchId,
      success: true,
      watched: savedMatch.watched,
    })
  }

  function handleWatchMatch(event, match) {
    event.preventDefault()
    event.stopPropagation()
    const savedMatch = markMatchWatched(match.id)
    refreshMatches()

    if (savedMatch?.watched && !match.watched) {
      track(ANALYTICS_EVENTS.MATCH_WATCHED_CHANGED, {
        matchId: match.id,
        success: true,
        watched: true,
      })
    }

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
        <div className="pill-row match-filter-pills">
          {FILTERS.map((item) => (
            <SketchButton
              active={item === activeFilter}
              className={`pill match-filter-pill${item === activeFilter ? ' is-active' : ''}`}
              handdrawnFill={{ color: '#F7D95C', opacity: 0.46, variant: 'marker' }}
              onClick={() => setActiveFilter(item)}
              type="button"
              variant="secondary"
              key={item}
            >
              <span className="match-filter-pill__label">{item}</span>
            </SketchButton>
          ))}
        </div>
      </section>

      <section className="match-list">
        {visibleMatches.map((match, index) => (
          <MatchCard
            index={index}
            match={match}
            onToggleFavorite={handleToggleFavorite}
            onToggleWatched={handleToggleWatched}
            onWatchMatch={handleWatchMatch}
            key={match.id}
          />
        ))}
      </section>
    </ContentLayout>
  )
}
