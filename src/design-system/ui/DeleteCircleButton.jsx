import './DeleteCircleButton.css'

export function DeleteCircleButton({ label = '删除', onClick, title = '删除' }) {
  return (
    <button
      aria-label={label}
      className="delete-circle-button"
      onClick={onClick}
      title={title}
      type="button"
    >
      <span aria-hidden="true">×</span>
    </button>
  )
}
