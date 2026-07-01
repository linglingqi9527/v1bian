import clsx from 'clsx'
import { HandDrawnAnimatedFill } from '../handdrawn/HandDrawnAnimatedFill.jsx'
import './SketchCard.css'

export function SketchCard({ active = false, children, className, level = 'card', ...props }) {
  return (
    <section
      className={clsx('sketch-card', `sketch-card--${level}`, active && 'sketch-card--active', className)}
      {...props}
    >
      {active ? <HandDrawnAnimatedFill active /> : null}
      {children}
    </section>
  )
}
