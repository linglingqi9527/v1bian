import { Link } from 'react-router'
import { DeleteCircleButton } from '../../../design-system/ui/DeleteCircleButton.jsx'
import { PriorityDotPicker } from '../../../design-system/ui/PriorityDotPicker.jsx'
import { SketchTag } from '../../../design-system/ui/SketchTag.jsx'
import { REVIEW_PRIORITY_OPTIONS, REVIEW_STATUS } from '../reviewUtils.js'
import './ReviewsList.css'

export function ReviewListRow({ item, onDelete, onPriorityChange }) {
  return (
    <article className="review-row">
      <DeleteCircleButton
        label={`删除赛评：${item.title}`}
        onClick={() => onDelete(item)}
        title="删除赛评"
      />
      <PriorityDotPicker
        onChange={(priority) => onPriorityChange(item.id, priority)}
        options={REVIEW_PRIORITY_OPTIONS}
        priority={item.priority}
      />
      <div className="review-row-main">
        <Link className="review-row-title handdrawn-underline-on-hover" to={`/reviews/${item.id}/edit`}>
          {item.title}
        </Link>
        <p className="muted">{item.meta}</p>
        <div className="review-row-meta">
          <SketchTag className={item.status === REVIEW_STATUS.draft ? 'tag-pink' : 'tag-blue'}>
            {item.status}
          </SketchTag>
          <span>{item.updatedLabel}</span>
          {item.trainingCount > 0 ? <span>已训练 {item.trainingCount}</span> : null}
        </div>
      </div>
      <span className="review-duration">{item.year}</span>
      <div className="review-row-actions">
        <Link className="mini-action" to={`/trainings/new?reviewId=${item.id}`}>
          训练
        </Link>
        <Link className="mini-action" to={`/reviews/${item.id}/edit`}>
          {item.status === REVIEW_STATUS.completed ? '编辑' : '继续编辑'}
        </Link>
      </div>
    </article>
  )
}
