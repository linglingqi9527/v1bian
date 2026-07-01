import { imageAssets } from '../../assets/assetPaths.js'
import clsx from 'clsx'
import './WorkbenchHeader.css'

export function WorkbenchHeader({
  actions,
  decoration = true,
  eyebrow,
  hero = 'default',
  meta,
  title,
  variant = 'default',
}) {
  return (
    <header
      className={clsx(
        'workbench-header',
        `workbench-header--${variant}`,
        `workbench-header--hero-${hero}`,
        !decoration && 'workbench-header--plain',
      )}
    >
      <div className="workbench-title-block">
        {eyebrow ? <p className="breadcrumb-line">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {meta ? <p className="header-meta">{meta}</p> : null}
      </div>
      <div className="shared-hero" aria-hidden="true">
        <img src={imageAssets.heroIllustration} alt="" />
        <div className="brand-slogan">
          <strong className="handdrawn-underline handdrawn-underline--brand">便了么</strong>
        </div>
      </div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </header>
  )
}
