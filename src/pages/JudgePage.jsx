import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { WorkbenchHeader } from '../design-system/layout/WorkbenchHeader.jsx'
import { JudgeSurface } from '../features/judge/components/JudgeSurface.jsx'

export default function JudgePage() {
  return (
    <ContentLayout>
      <WorkbenchHeader
        decoration={false}
        eyebrow="Judge / 判断 / 汇总 / 会话"
        hero="trainings"
        title="Judge"
        meta="导入比赛/训练材料 即可开始自动评审"
        variant="compact"
      />
      <JudgeSurface mode="page" />
    </ContentLayout>
  )
}
