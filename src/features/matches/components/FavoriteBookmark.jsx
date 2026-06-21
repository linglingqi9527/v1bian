import { Bookmark } from 'lucide-react'
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
      {favorite ? (
        <HandDrawnSelectionFill
          active
          className="bookmark-mark__fill"
          fill="#F7D95C"
          fillWeight={2.2}
          hachureGap={6}
          overflow={0}
          preset="compactSelectionFill"
          roughness={0.95}
          shape="bookmark"
          stroke="#1f1f1f"
          strokeWidth={1.7}
        />
      ) : (
        <Bookmark aria-hidden="true" className="bookmark-mark__icon" strokeWidth={2.2} />
      )}
    </button>
  )
}
