import { Link } from 'react-router'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { PageHeader } from '../design-system/layout/PageHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { SketchCard } from '../design-system/ui/SketchCard.jsx'
import { SketchTag } from '../design-system/ui/SketchTag.jsx'

export default function HomePage() {
  return (
    <ContentLayout>
      <PageHeader
        eyebrow="辩了么"
        title="给辩手的看赛、赛评、训练工作台"
        description="当前只搭建可扩展结构，所有数据均为 demo-user 的本地示例数据。"
      />

      <div className="flow-grid">
        {['看比赛', '写赛评', '做训练', '我的'].map((item) => (
          <SketchCard key={item}>
            <SketchTag>{item}</SketchTag>
            <p className="muted">后续功能会沿着这个入口逐步展开。</p>
          </SketchCard>
        ))}
      </div>

      <div className="actions-row">
        <SketchButton as={Link} to="/matches">
          看比赛
        </SketchButton>
        <SketchButton as={Link} to="/reviews" variant="secondary">
          写赛评
        </SketchButton>
      </div>
    </ContentLayout>
  )
}
