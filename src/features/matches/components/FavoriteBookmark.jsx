import { HandDrawnSelectionFill } from '../../../design-system/handdrawn/HandDrawnSelectionFill.jsx'

export function FavoriteBookmark({ favorite, onClick }) {
  return (
    <button
      aria-label={favorite ? '取消收藏比赛' : '收藏比赛'}
      aria-pressed={favorite}
      className="bookmark-mark"
      data-favorite={favorite ? 'true' : 'false'}
      onClick={onClick}
      type="button"
    >
      <HandDrawnSelectionFill
        active={favorite}
        className="bookmark-mark__fill"
        fill="#F7D95C"
        overflow={0}
        preset="compactSelectionFill"
        shape="rectangle"
      />
    </button>
  )
}
