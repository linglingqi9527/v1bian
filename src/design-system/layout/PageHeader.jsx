export function PageHeader({ description, eyebrow, title }) {
  return (
    <header className="page-header">
      {eyebrow ? <p className="eyebrow handdrawn-underline handdrawn-underline--eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {description ? <p className="muted">{description}</p> : null}
    </header>
  )
}
