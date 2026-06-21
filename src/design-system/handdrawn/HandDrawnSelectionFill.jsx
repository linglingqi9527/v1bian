import { useEffect, useMemo, useRef } from 'react'
import rough from 'roughjs'
import { handdrawnPresets } from './handdrawnPresets.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function HandDrawnSelectionFill({
  active = true,
  animated = true,
  bowing,
  className = '',
  duration = 220,
  fill,
  fillStyle,
  fillWeight,
  hachureAngle,
  hachureGap,
  overflow,
  preset = 'selectionFill',
  roughness,
  shape = 'pill',
  stroke,
  strokeWidth,
}) {
  const fillRef = useRef(null)
  const options = useMemo(() => {
    const presetOptions = handdrawnPresets[preset] ?? handdrawnPresets.selectionFill

    return {
      ...presetOptions,
      bowing: bowing ?? presetOptions.bowing,
      fill: fill ?? presetOptions.fill,
      fillStyle: fillStyle ?? presetOptions.fillStyle,
      fillWeight: fillWeight ?? presetOptions.fillWeight,
      hachureAngle: hachureAngle ?? presetOptions.hachureAngle,
      hachureGap: hachureGap ?? presetOptions.hachureGap,
      overflow: overflow ?? presetOptions.overflow,
      roughness: roughness ?? presetOptions.roughness,
      shape,
      stroke: stroke ?? presetOptions.stroke,
      strokeWidth: strokeWidth ?? presetOptions.strokeWidth,
    }
  }, [
    bowing,
    fill,
    fillStyle,
    fillWeight,
    hachureAngle,
    hachureGap,
    overflow,
    preset,
    roughness,
    shape,
    stroke,
    strokeWidth,
  ])

  useEffect(() => {
    const element = fillRef.current
    if (!element || !active) return undefined

    const draw = () => drawSelectionFill(element, options)
    draw()

    const observer = new ResizeObserver(draw)
    observer.observe(element)

    return () => observer.disconnect()
  }, [active, options])

  if (!active) return null

  return (
    <span
      aria-hidden="true"
      className={[
        'handdrawn-selection-fill',
        animated ? 'handdrawn-selection-fill--enter' : '',
        className,
      ].filter(Boolean).join(' ')}
      ref={fillRef}
      style={{
        '--handdrawn-selection-duration': `${duration}ms`,
        inset: `${-options.overflow}px`,
      }}
    />
  )
}

function drawSelectionFill(element, options) {
  const width = Math.round(element.clientWidth)
  const height = Math.round(element.clientHeight)
  if (width < 8 || height < 8) return

  const key = [
    width,
    height,
    options.shape,
    options.fill,
    options.stroke,
    options.strokeWidth,
    options.fillWeight,
    options.hachureAngle,
    options.hachureGap,
    options.roughness,
    options.bowing,
  ].join('-')

  if (element.dataset.selectionFillKey === key) return

  element.replaceChildren(createSelectionSvg(width, height, options))
  element.dataset.selectionFillKey = key
}

function createSelectionSvg(width, height, options) {
  const svg = document.createElementNS(SVG_NS, 'svg')
  const rc = rough.svg(svg)
  const padding = Math.max(2, options.strokeWidth)
  const x = padding
  const y = padding
  const drawWidth = Math.max(1, width - padding * 2)
  const drawHeight = Math.max(1, height - padding * 2)
  const roughOptions = {
    bowing: options.bowing,
    disableMultiStroke: false,
    disableMultiStrokeFill: false,
    fill: options.fill,
    fillStyle: options.fillStyle ?? 'hachure',
    fillWeight: options.fillWeight,
    fixedDecimalPlaceDigits: 2,
    hachureAngle: options.hachureAngle,
    hachureGap: options.hachureGap,
    roughness: options.roughness,
    stroke: options.stroke,
    strokeWidth: options.strokeWidth,
  }

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.setAttribute('focusable', 'false')

  const shape = createRoughShape(rc, options.shape, x, y, drawWidth, drawHeight, roughOptions)
  svg.appendChild(shape)

  return svg
}

function createRoughShape(rc, shape, x, y, width, height, options) {
  if (shape === 'circle') {
    const diameter = Math.min(width, height)
    return rc.circle(x + width / 2, y + height / 2, diameter, options)
  }

  if (shape === 'rectangle') {
    return rc.rectangle(x, y, width, height, options)
  }

  if (shape === 'bookmark') {
    return rc.path(bookmarkPath(x, y, width, height), options)
  }

  const radius = Math.min(height / 2, 14)
  return rc.path(roundedRectPath(x, y, width, height, radius), options)
}

function bookmarkPath(x, y, width, height) {
  const right = x + width
  const bottom = y + height
  const notchY = bottom - Math.min(height * 0.28, width * 0.48)
  const radius = Math.min(2, width * 0.12)

  return [
    `M ${x + radius} ${y}`,
    `L ${right - radius} ${y}`,
    `Q ${right} ${y}, ${right} ${y + radius}`,
    `L ${right} ${bottom}`,
    `L ${x + width / 2} ${notchY}`,
    `L ${x} ${bottom}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y}, ${x + radius} ${y}`,
    'Z',
  ].join(' ')
}

function roundedRectPath(x, y, width, height, radius) {
  const right = x + width
  const bottom = y + height
  const r = Math.max(2, Math.min(radius, width / 2, height / 2))

  return [
    `M ${x + r} ${y}`,
    `L ${right - r} ${y}`,
    `Q ${right} ${y}, ${right} ${y + r}`,
    `L ${right} ${bottom - r}`,
    `Q ${right} ${bottom}, ${right - r} ${bottom}`,
    `L ${x + r} ${bottom}`,
    `Q ${x} ${bottom}, ${x} ${bottom - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y}, ${x + r} ${y}`,
    'Z',
  ].join(' ')
}
