import { imageAssets } from '../../../assets/assetPaths.js'
import { FavoriteBookmark } from './FavoriteBookmark.jsx'
import { MatchAccentStroke } from './MatchAccentStroke.jsx'
import { MatchActionButton } from './MatchActionButton.jsx'
import { MatchStatusTags } from './MatchStatusTags.jsx'
import {
  formatMatchSpeakers,
  formatMatchTeams,
  getMatchReviewRoute,
  getMatchTrainingRoute,
} from '../matchUtils.js'
import './MatchCard.css'

export function MatchCard({
  index,
  match,
  onToggleFavorite,
  onToggleWatched,
  onWatchMatch,
}) {
  function handleTitleKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onWatchMatch(event, match)
  }

  return (
    <article className="match-card">
      <MatchAccentStroke index={index} />
      <aside className="match-side">
        <span className="match-side-event">{match.event.replace('bilibili', '')}</span>
        <strong>{match.stage}</strong>
      </aside>
      <div className="match-main">
        <p className="match-school">{formatMatchTeams(match)} · {match.date} · {match.bvId}</p>
        <h2
          aria-label={`观看比赛：${match.title}`}
          className="match-card-title handdrawn-multiline-underline-trigger handdrawn-multiline-underline--match-title"
          onClick={(event) => onWatchMatch(event, match)}
          onKeyDown={handleTitleKeyDown}
          role="button"
          tabIndex={0}
        >
          <span className="handdrawn-multiline-underline-on-hover">{match.title}</span>
        </h2>
        <p className="match-speakers">{formatMatchSpeakers(match)}</p>
        <MatchStatusTags match={match} onToggleWatched={onToggleWatched} />
      </div>
      <div className="match-actions">
        <MatchActionButton
          action="watch"
          icon={imageAssets.matchCard.watchVideo}
          label="观看比赛"
          onClick={(event) => onWatchMatch(event, match)}
          to={`/matches/${match.id}`}
        />
        <MatchActionButton
          action="review"
          icon={imageAssets.matchCard.writeReview}
          label="打开赛评"
          to={getMatchReviewRoute(match)}
        />
        <MatchActionButton
          action="train"
          icon={imageAssets.matchCard.startTraining}
          label="开始训练"
          to={getMatchTrainingRoute(match)}
        />
      </div>
      <FavoriteBookmark
        favorite={match.favorite}
        onClick={(event) => {
          event.stopPropagation()
          onToggleFavorite(match.id)
        }}
      />
    </article>
  )
}
