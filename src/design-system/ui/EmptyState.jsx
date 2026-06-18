import { ContentLayout } from '../layout/ContentLayout.jsx'
import { SketchCard } from './SketchCard.jsx'

export function EmptyState({ title, description }) {
  return (
    <ContentLayout>
      <SketchCard className="empty-state">
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </SketchCard>
    </ContentLayout>
  )
}
