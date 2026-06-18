import { Link, useParams } from 'react-router'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { PageHeader } from '../design-system/layout/PageHeader.jsx'
import { EmptyState } from '../design-system/ui/EmptyState.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { SketchCard } from '../design-system/ui/SketchCard.jsx'
import { getMatchById } from '../features/matches/matchService.js'
import { getReviewByMatchId } from '../features/reviews/reviewService.js'

export default function MatchDetailPage() {
  const { matchId } = useParams()
  const match = getMatchById(matchId)
  const review = getReviewByMatchId(matchId)

  if (!match) {
    return <EmptyState title="未找到比赛" description="这个比赛可能还没有导入到本地 demo 数据。" />
  }

  return (
    <ContentLayout>
      <PageHeader eyebrow="比赛详情" title={match.title} description={match.topic} />
      <SketchCard>
        <p>{match.summary}</p>
        <div className="actions-row">
          <SketchButton as={Link} to={`/reviews/match/${match.id}/edit`}>
            写赛评
          </SketchButton>
          {review ? (
            <SketchButton as={Link} to={`/reviews/${review.id}`} variant="secondary">
              查看赛评
            </SketchButton>
          ) : null}
        </div>
      </SketchCard>
    </ContentLayout>
  )
}
