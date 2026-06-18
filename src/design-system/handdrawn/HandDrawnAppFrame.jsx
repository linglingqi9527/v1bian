import { useEffect, useRef, useState } from 'react'

export function HandDrawnAppFrame() {
  const svgRef = useRef(null)
  const [frame, setFrame] = useState({ height: 0, navWidth: 0, width: 0 })

  useEffect(() => {
    const svg = svgRef.current
    const shell = svg?.parentElement
    if (!shell) return undefined

    const updateFrame = () => {
      const shellStyles = window.getComputedStyle(shell)
      const navWidth = Number.parseFloat(shellStyles.getPropertyValue('--nav-width')) || 0
      const safeX = Number.parseFloat(shellStyles.getPropertyValue('--frame-safe-x')) || 0

      setFrame({
        height: shell.clientHeight,
        navWidth: navWidth + safeX,
        width: shell.clientWidth,
      })
    }

    updateFrame()
    const observer = new ResizeObserver(updateFrame)
    observer.observe(shell)

    return () => observer.disconnect()
  }, [])

  const { height, navWidth, width } = frame
  const outerPath = createOuterPath(width, height)
  const dividerPath = navWidth > 24 ? createDividerPath(navWidth, height) : ''

  return (
    <svg
      ref={svgRef}
      className="app-frame-border"
      height={height}
      viewBox={`0 0 ${width || 1} ${height || 1}`}
      width={width}
      aria-hidden="true"
    >
      {outerPath ? (
        <path className="app-frame-border__line" d={outerPath} />
      ) : null}
      {dividerPath ? (
        <path className="app-frame-border__line app-frame-border__divider" d={dividerPath} />
      ) : null}
    </svg>
  )
}

function createOuterPath(width, height) {
  if (!width || !height) return ''

  const inset = 8
  const radius = 22
  const right = width - inset
  const bottom = height - inset
  const left = inset
  const top = inset

  return [
    `M ${left + radius} ${top + 1}`,
    `C ${width * 0.18} ${top - 3}, ${width * 0.34} ${top + 7}, ${width * 0.49} ${top + 2}`,
    `C ${width * 0.67} ${top - 2}, ${width * 0.82} ${top + 5}, ${right - radius} ${top + 1}`,
    `Q ${right - 2} ${top + 2}, ${right - 1} ${top + radius}`,
    `C ${right + 3} ${height * 0.26}, ${right - 5} ${height * 0.48}, ${right - 1} ${height * 0.66}`,
    `C ${right + 2} ${height * 0.79}, ${right - 4} ${height * 0.9}, ${right - 1} ${bottom - radius}`,
    `Q ${right - 1} ${bottom - 2}, ${right - radius} ${bottom - 1}`,
    `C ${width * 0.79} ${bottom + 4}, ${width * 0.62} ${bottom - 5}, ${width * 0.44} ${bottom - 1}`,
    `C ${width * 0.28} ${bottom + 3}, ${width * 0.14} ${bottom - 4}, ${left + radius} ${bottom - 1}`,
    `Q ${left + 1} ${bottom - 2}, ${left + 1} ${bottom - radius}`,
    `C ${left - 3} ${height * 0.74}, ${left + 5} ${height * 0.55}, ${left + 1} ${height * 0.37}`,
    `C ${left - 2} ${height * 0.22}, ${left + 4} ${height * 0.12}, ${left + 1} ${top + radius}`,
    `Q ${left + 2} ${top + 3}, ${left + radius} ${top + 1}`,
  ].join(' ')
}

function createDividerPath(navWidth, height) {
  const top = 8
  const bottom = height - 8
  const x = navWidth

  return [
    `M ${x - 1} ${top + 3}`,
    `C ${x + 5} ${height * 0.16}, ${x - 6} ${height * 0.31}, ${x + 1} ${height * 0.46}`,
    `C ${x + 6} ${height * 0.58}, ${x - 5} ${height * 0.76}, ${x + 1} ${bottom - 22}`,
    `Q ${x + 3} ${bottom - 4}, ${x - 2} ${bottom - 1}`,
  ].join(' ')
}
