import { Link } from 'react-router'
import { DeleteCircleButton } from '../../../design-system/ui/DeleteCircleButton.jsx'
import { PriorityDotPicker } from '../../../design-system/ui/PriorityDotPicker.jsx'
import { SketchTag } from '../../../design-system/ui/SketchTag.jsx'
import { REVIEW_PRIORITY_OPTIONS } from '../../reviews/reviewUtils.js'
import './TrainingsList.css'

export function TrainingListRow({ item, onDelete, onPriorityChange }) {
  return (
    <article className="training-row">
      <DeleteCircleButton
        label={`删除训练：${item.title}`}
        onClick={() => onDelete(item)}
        title="删除训练"
      />
      <PriorityDotPicker
        onChange={(priority) => onPriorityChange(item.id, priority)}
        options={REVIEW_PRIORITY_OPTIONS}
        priority={item.priority}
      />
      <div className="training-row-main">
        <Link className="training-row-title handdrawn-underline-on-hover" to={`/trainings/${item.id}`}>
          {item.title}
        </Link>
        <p className="muted">{item.meta}</p>
        <div className="training-row-meta">
          <SketchTag className={item.mode === 'video' ? 'tag-yellow' : 'tag-blue'}>
            {item.modeLabel}
          </SketchTag>
          <span>{item.dateLabel}</span>
          <span>{item.note}</span>
        </div>
      </div>
      <span className="training-duration">{item.year}</span>
      <div className="training-row-actions">
        <Link className="mini-action" to={`/trainings/${item.id}`}>
          查看训练
        </Link>
        <Link className="mini-action" to={`/trainings/${item.id}`}>
          继续训练
        </Link>
      </div>
    </article>
  )
}
