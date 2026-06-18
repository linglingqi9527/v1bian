export function HandDrawnFilters() {
  return (
    <svg className="handdrawn-filters" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="handdrawn-border-wobble" x="-8%" y="-8%" width="116%" height="116%">
        <feTurbulence type="fractalNoise" baseFrequency="0.018 0.035" numOctaves="1" seed="8" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.05" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
