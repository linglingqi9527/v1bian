import clsx from 'clsx'

export function IconButton({ icon, label, className, ...props }) {
  return (
    <button className={clsx('icon-button', className)} type="button" {...props}>
      {icon ? <img src={icon} alt="" /> : null}
      <span>{label}</span>
    </button>
  )
}
