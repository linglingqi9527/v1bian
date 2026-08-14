export function HandDrawnArrow({ className = '', variant = 'line' }) {
  if (variant === 'turn') {
    return (
      <svg className={`handdrawn-shape ${className}`} viewBox="0 0 120 90" aria-hidden="true">
        <path d="M8 27 C19 23 29 20 36 20" />
        <path d="M79 20 C89 22 94 34 86 50" />
        <path d="M79 39 L86 50 L98 43" />
      </svg>
    )
  }

  return <svg className={`handdrawn-shape ${className}`} viewBox="0 0 120 40" aria-hidden="true"><path d="M4 20 C38 12 72 13 112 19" /><path d="M99 9 L114 19 L99 31" /></svg>
}
