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
        title="法官"
        meta="导入材料后再开始判断；从赛评和训练呼出时会自动带入上下文。"
        variant="compact"
      />
      <JudgeSurface mode="page" />
    </ContentLayout>
  )
}
