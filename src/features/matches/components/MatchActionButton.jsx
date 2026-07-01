import { Link } from 'react-router'
import { SketchButton } from '../../../design-system/ui/SketchButton.jsx'

export function MatchActionButton({ action, icon, label, onClick, to }) {
  function handleClick(event) {
    event.stopPropagation()
    onClick?.(event)
  }

  return (
    <SketchButton
      active={action === 'watch'}
      as={Link}
      className="match-action-link"
      data-match-action={action}
      handdrawnFill={{ color: '#F7D95C', opacity: 0.44, variant: 'marker' }}
      icon={<img src={icon} alt="" />}
      onClick={handleClick}
      to={to}
      variant="secondary"
    >
      <span className="match-action-link__label">{label}</span>
    </SketchButton>
  )
}
