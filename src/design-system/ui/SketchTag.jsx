import clsx from 'clsx'
import { HandDrawnSelectionFill } from '../handdrawn/HandDrawnSelectionFill.jsx'
import { handdrawnToneFills } from '../handdrawn/handdrawnPresets.js'

export function SketchTag({ active, children, className, tone = 'gray', ...props }) {
  const resolvedTone = resolveTone(tone, className)
  const showFill = active ?? resolvedTone !== 'gray'

  return (
    <span
      className={clsx(
        'sketch-tag',
        `sketch-tag--${resolvedTone}`,
        showFill && 'sketch-tag--active',
        className,
      )}
      {...props}
    >
      {showFill ? (
        <HandDrawnSelectionFill
          active
          fill={toneToFillColor(resolvedTone)}
          preset="tagActiveFill"
          shape="pill"
        />
      ) : null}
      <span className="sketch-tag__content">{children}</span>
    </span>
  )
}

function resolveTone(tone, className = '') {
  if (tone !== 'gray') return tone
  if (className.includes('tag-blue')) return 'blue'
  if (className.includes('tag-green')) return 'green'
  if (className.includes('tag-pink')) return 'pink'
  if (className.includes('tag-yellow')) return 'yellow'
  return 'gray'
}

function toneToFillColor(tone) {
  return handdrawnToneFills[tone] ?? handdrawnToneFills.current
}
