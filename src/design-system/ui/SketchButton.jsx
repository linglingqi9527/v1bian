import clsx from 'clsx'
import { HandDrawnSelectionFill } from '../handdrawn/HandDrawnSelectionFill.jsx'
import './SketchButton.css'

export function SketchButton({
  active = false,
  as: Component = 'button',
  children,
  className,
  handdrawnFill = true,
  icon,
  size = 'md',
  variant = 'primary',
  ...props
}) {
  const isDisabled = Boolean(props.disabled || props['aria-disabled'] === true || props['aria-disabled'] === 'true')
  const shouldFillPrimary = variant === 'primary' && handdrawnFill !== false && !isDisabled
  const fillActive = active || shouldFillPrimary
  const fillProps = typeof handdrawnFill === 'object' ? handdrawnFill : {}
  const selectionFillProps = {
    ...fillProps,
    fill: fillProps.fill ?? fillProps.color,
    preset: fillProps.preset ?? 'buttonActiveFill',
    shape: fillProps.shape ?? 'pill',
    stroke: fillProps.stroke,
  }
  const showFill = fillActive && handdrawnFill !== false

  return (
    <Component
      className={clsx(
        'sketch-button',
        `sketch-button--${variant}`,
        `sketch-button--${size}`,
        active && 'sketch-button--active',
        showFill && 'sketch-button--filled',
        className,
      )}
      {...props}
    >
      {showFill ? <HandDrawnSelectionFill active={fillActive} {...selectionFillProps} /> : null}
      <span className="sketch-button__content">
        {icon ? <span className="sketch-button__icon">{icon}</span> : null}
        {children}
      </span>
    </Component>
  )
}
