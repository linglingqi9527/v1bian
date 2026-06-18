import clsx from 'clsx'

export function SketchInput({ className, label, id, ...props }) {
  return (
    <label className="field" htmlFor={id}>
      {label ? <span>{label}</span> : null}
      <input id={id} className={clsx('sketch-input', className)} {...props} />
    </label>
  )
}
