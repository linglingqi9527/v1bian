import { SketchTag } from '../../../design-system/ui/SketchTag.jsx'
import { getMatchStatusTags } from '../matchUtils.js'

export function MatchStatusTags({ match, onToggleWatched }) {
  function handleStatusKeyDown(event, tag) {
    if (tag.kind !== 'watched') return
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onToggleWatched(event, match.id)
  }

  return (
    <div className="match-status-row">
      {getMatchStatusTags(match).map((tag) => (
        <SketchTag
          active={tag.active}
          aria-label={tag.kind === 'watched' ? `${tag.label}，点击切换已看状态` : undefined}
          onClick={tag.kind === 'watched' ? (event) => onToggleWatched(event, match.id) : undefined}
          onKeyDown={(event) => handleStatusKeyDown(event, tag)}
          role={tag.kind === 'watched' ? 'button' : undefined}
          tabIndex={tag.kind === 'watched' ? 0 : undefined}
          tone={tag.tone}
          key={tag.label}
        >
          {tag.label}
        </SketchTag>
      ))}
    </div>
  )
}
