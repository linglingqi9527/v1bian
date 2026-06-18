import clsx from 'clsx'

export function SketchTextarea({ className, label, id, ...props }) {
  return (
    <label className="field" htmlFor={id}>
      {label ? <span>{label}</span> : null}
      <textarea id={id} className={clsx('sketch-input sketch-textarea', className)} {...props} />
    </label>
  )
}
