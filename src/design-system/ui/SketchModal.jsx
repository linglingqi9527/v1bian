import clsx from 'clsx'
import { SketchButton } from './SketchButton.jsx'

export function SketchModal({ children, className, onClose, open, title }) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <section className={clsx('sketch-modal', className)} role="dialog" aria-modal="true" aria-label={title}>
        <div className="card-header">
          <h2>{title}</h2>
          <SketchButton type="button" variant="secondary" onClick={onClose}>
            关闭
          </SketchButton>
        </div>
        {children}
      </section>
    </div>
  )
}
