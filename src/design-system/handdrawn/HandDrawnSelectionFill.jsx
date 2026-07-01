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
  texture,
  textureDensity,
  textureOpacity,
  textureStrokeWidth,
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
      texture: texture ?? presetOptions.texture,
      textureDensity: textureDensity ?? presetOptions.textureDensity,
      textureOpacity: textureOpacity ?? presetOptions.textureOpacity,
      textureStrokeWidth: textureStrokeWidth ?? presetOptions.textureStrokeWidth,
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
    texture,
    textureDensity,
    textureOpacity,
    textureStrokeWidth,
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
    options.texture,
    options.textureDensity,
    options.textureOpacity,
    options.textureStrokeWidth,
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
  if (options.texture === 'crayon') {
    svg.appendChild(createCrayonTexture(svg, options, x, y, drawWidth, drawHeight))
    svg.appendChild(createRoughShape(rc, options.shape, x, y, drawWidth, drawHeight, {
      bowing: options.bowing,
      disableMultiStroke: false,
      fill: undefined,
      fixedDecimalPlaceDigits: 2,
      roughness: options.roughness,
      stroke: options.stroke,
      strokeWidth: Math.max(1, options.strokeWidth * 0.78),
    }))
  }

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

function createCrayonTexture(svg, options, x, y, width, height) {
  const defs = document.createElementNS(SVG_NS, 'defs')
  const clipPath = document.createElementNS(SVG_NS, 'clipPath')
  const clipId = `selection-crayon-${Math.random().toString(36).slice(2)}`
  clipPath.setAttribute('id', clipId)
  clipPath.appendChild(createClipShape(options.shape, x, y, width, height))
  defs.appendChild(clipPath)
  svg.appendChild(defs)

  const group = document.createElementNS(SVG_NS, 'g')
  group.setAttribute('clip-path', `url(#${clipId})`)
  group.setAttribute('opacity', String(options.textureOpacity ?? 0.38))

  const seed = hashNumber([
    width,
    height,
    options.fill,
    options.hachureAngle,
    options.hachureGap,
  ].join(':'))
  const random = seededRandom(seed)
  const density = Math.max(4, Number(options.textureDensity ?? 18))
  const angle = (Number(options.hachureAngle ?? -35) * Math.PI) / 180
  const baseLength = Math.max(12, Math.min(width, height) * 0.62)

  for (let index = 0; index < density; index += 1) {
    const cx = x + random() * width
    const cy = y + random() * height
    const length = baseLength * (0.36 + random() * 0.56)
    const lineAngle = angle + (random() - 0.5) * 0.22
    const lineDx = Math.cos(lineAngle)
    const lineDy = Math.sin(lineAngle)
    const wobble = (random() - 0.5) * 4
    const strokeWidth = Number(options.textureStrokeWidth ?? options.fillWeight * 0.44)
      * (0.55 + random() * 0.9)
    const line = document.createElementNS(SVG_NS, 'line')
    line.setAttribute('x1', String(cx - lineDx * length / 2 + wobble))
    line.setAttribute('y1', String(cy - lineDy * length / 2 - wobble))
    line.setAttribute('x2', String(cx + lineDx * length / 2 - wobble))
    line.setAttribute('y2', String(cy + lineDy * length / 2 + wobble))
    line.setAttribute('stroke', options.fill)
    line.setAttribute('stroke-width', String(strokeWidth))
    line.setAttribute('stroke-linecap', 'round')
    line.setAttribute('opacity', String(0.18 + random() * 0.28))
    group.appendChild(line)
  }

  for (let index = 0; index < Math.ceil(density / 3); index += 1) {
    const cx = x + random() * width
    const cy = y + random() * height
    const length = baseLength * (0.18 + random() * 0.32)
    const scratchAngle = angle + (random() - 0.5) * 0.28
    const scratchDx = Math.cos(scratchAngle)
    const scratchDy = Math.sin(scratchAngle)
    const scratch = document.createElementNS(SVG_NS, 'line')
    scratch.setAttribute('x1', String(cx - scratchDx * length / 2))
    scratch.setAttribute('y1', String(cy - scratchDy * length / 2))
    scratch.setAttribute('x2', String(cx + scratchDx * length / 2))
    scratch.setAttribute('y2', String(cy + scratchDy * length / 2))
    scratch.setAttribute('stroke', '#fff8cf')
    scratch.setAttribute('stroke-width', String(0.8 + random() * 1.2))
    scratch.setAttribute('stroke-linecap', 'round')
    scratch.setAttribute('opacity', String(0.12 + random() * 0.16))
    group.appendChild(scratch)
  }

  return group
}

function createClipShape(shape, x, y, width, height) {
  if (shape === 'circle') {
    const circle = document.createElementNS(SVG_NS, 'circle')
    const diameter = Math.min(width, height)
    circle.setAttribute('cx', String(x + width / 2))
    circle.setAttribute('cy', String(y + height / 2))
    circle.setAttribute('r', String(diameter / 2))
    return circle
  }

  const pathElement = document.createElementNS(SVG_NS, 'path')
  if (shape === 'bookmark') {
    pathElement.setAttribute('d', bookmarkPath(x, y, width, height))
    return pathElement
  }
  if (shape === 'rectangle') {
    pathElement.setAttribute('d', rectanglePath(x, y, width, height))
    return pathElement
  }
  pathElement.setAttribute('d', roundedRectPath(x, y, width, height, Math.min(height / 2, 14)))
  return pathElement
}

function rectanglePath(x, y, width, height) {
  const right = x + width
  const bottom = y + height
  return [
    `M ${x} ${y}`,
    `L ${right} ${y}`,
    `L ${right} ${bottom}`,
    `L ${x} ${bottom}`,
    'Z',
  ].join(' ')
}

function hashNumber(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandom(seed) {
  let value = seed || 1
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
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
