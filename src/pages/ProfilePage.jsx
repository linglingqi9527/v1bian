import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { PageHeader } from '../design-system/layout/PageHeader.jsx'
import { SketchCard } from '../design-system/ui/SketchCard.jsx'
import { DEMO_USER_ID } from '../models/userModel.js'

export default function ProfilePage() {
  return (
    <ContentLayout>
      <PageHeader eyebrow="我的" title="个人空间" description="私人数据已经预留 userId 字段。" />
      <SketchCard>
        <p>当前用户：{DEMO_USER_ID}</p>
      </SketchCard>
    </ContentLayout>
  )
}
