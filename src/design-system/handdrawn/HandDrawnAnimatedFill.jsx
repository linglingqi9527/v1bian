import { useEffect, useMemo, useRef } from 'react'
import rough from 'roughjs'

const SVG_NS = 'http://www.w3.org/2000/svg'

const TONE_OPTIONS = {
  current: {
    color: '#F7D95C',
    variant: 'marker',
    fillWeight: 3.4,
    gap: 11,
    angle: -34,
    opacity: 0.46,
    seed: 31,
  },
  marked: {
    color: '#82BFFF',
    variant: 'marker',
    fillWeight: 3,
    gap: 12,
    angle: -34,
    opacity: 0.42,
    seed: 37,
  },
  green: {
    color: '#8EDB78',
    variant: 'marker',
    fillWeight: 3.2,
    gap: 12,
    angle: -35,
    opacity: 0.43,
    seed: 41,
  },
}

export function HandDrawnAnimatedFill({
  active = true,
  animated = true,
  className = '',
  color,
  duration = 220,
  gap,
  opacity,
  strokeWidth,
  tone = 'current',
  variant,
}) {
  const fillRef = useRef(null)
  const options = useMemo(() => {
    const baseOptions = TONE_OPTIONS[tone] ?? TONE_OPTIONS.current

    return {
      ...baseOptions,
      color: color ?? baseOptions.color,
      fillWeight: strokeWidth ?? baseOptions.fillWeight,
      gap: gap ?? baseOptions.gap,
      opacity: opacity ?? baseOptions.opacity,
      variant: variant ?? baseOptions.variant,
    }
  }, [color, gap, opacity, strokeWidth, tone, variant])

  useEffect(() => {
    const element = fillRef.current
    if (!element || !active) return undefined

    const draw = () => drawFill(element, options)
    draw()

    const observer = new ResizeObserver(draw)
    observer.observe(element)

    return () => observer.disconnect()
  }, [active, options])

  if (!active) return null

  return (
    <span
      ref={fillRef}
      style={{ '--handdrawn-fill-duration': `${duration}ms` }}
      className={[
        'handdrawn-animated-fill',
        animated ? 'handdrawn-animated-fill--enter' : '',
        className,
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  )
}

function drawFill(element, options) {
  const width = Math.round(element.clientWidth)
  const height = Math.round(element.clientHeight)
  if (width < 8 || height < 8) return

  const key = `${width}x${height}-${options.color}-${options.fillWeight}-${options.gap}-${options.opacity}-${options.variant}-${options.seed}`
  if (element.dataset.fillKey === key) return

  element.replaceChildren(createFillSvg(width, height, options))
  element.dataset.fillKey = key
}

function createFillSvg(width, height, options) {
  const svg = document.createElementNS(SVG_NS, 'svg')
  const rc = rough.svg(svg)
  const inset = 2
  const fillWidth = Math.max(1, width - inset * 2)
  const fillHeight = Math.max(1, height - inset * 2)
  const radius = Math.min(12, fillHeight * 0.36)

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.setAttribute('focusable', 'false')

  const fill = rc.path(
    softRectPath(inset, inset, fillWidth, fillHeight, radius),
    {
      bowing: 1.1,
      disableMultiStroke: true,
      disableMultiStrokeFill: false,
      fill: options.color,
      fillStyle: options.variant === 'hachure' ? 'hachure' : 'solid',
      fillWeight: options.fillWeight,
      fixedDecimalPlaceDigits: 2,
      hachureAngle: options.angle,
      hachureGap: options.gap,
      roughness: 0.95,
      seed: options.seed,
      stroke: 'transparent',
      strokeWidth: 0,
    },
  )

  fill.setAttribute('opacity', `${options.opacity}`)
  svg.appendChild(fill)

  return svg
}

function softRectPath(x, y, width, height, radius) {
  const right = x + width
  const bottom = y + height
  const r = Math.max(3, Math.min(radius, width / 2, height / 2))

  return [
    `M ${x + r} ${y + 1}`,
    `C ${x + width * 0.3} ${y - 1}, ${x + width * 0.68} ${y + 1}, ${right - r} ${y}`,
    `Q ${right} ${y}, ${right - 1} ${y + r}`,
    `L ${right} ${bottom - r}`,
    `Q ${right} ${bottom}, ${right - r} ${bottom - 1}`,
    `C ${x + width * 0.72} ${bottom + 1}, ${x + width * 0.32} ${bottom - 1}, ${x + r} ${bottom}`,
    `Q ${x} ${bottom}, ${x + 1} ${bottom - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y}, ${x + r} ${y + 1}`,
    'Z',
  ].join(' ')
}
