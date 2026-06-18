import { ArrowLeft, Bold, Download, Image, Italic, Link2, List, MoreHorizontal, Quote, Redo2, Underline, Undo2 } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { WorkbenchHeader } from '../design-system/layout/WorkbenchHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { SketchTag } from '../design-system/ui/SketchTag.jsx'
import { getReviewById } from '../features/reviews/reviewService.js'

const toc = ['1. 核心观点', '2. 论证分析', '2.1 论据质量', '2.2 论证结构', '2.3 反驳能力', '3. 亮点记录', '4. 问题与建议', '5. 总结评价', '6. 相关资料', '7. 训练记录', '8. 复盘对比']

export default function ReviewDetailPage() {
  const { reviewId } = useParams()
  const review = getReviewById(reviewId)

  return (
    <ContentLayout>
      <WorkbenchHeader
        actions={<><SketchButton>编辑赛评</SketchButton><SketchButton variant="secondary"><Download size={18} />导出</SketchButton><SketchButton variant="secondary"><MoreHorizontal size={18} /></SketchButton></>}
        eyebrow="新国辩数据库 / 赛评 / 语言的边界是 / 不是人类的边界（已完成）"
        hero="review-editor"
        title="语言的边界是 / 不是人类的边界"
        meta="香港大学 vs 北京师范大学 · 2026-01-24 · 02:07:09"
        variant="compact"
      />

      <Link className="back-link" to="/reviews"><ArrowLeft size={18} />返回列表</Link>
      <SketchTag className="tag-blue">已完成</SketchTag>
      <span className="last-edit">最后编辑：2天前</span>

      <section className="editor-shell">
        <aside className="toc-panel">
          <h2>目录（8）</h2>
          {toc.map((item, index) => (
            <button className={index === 0 ? 'toc-item toc-item--active' : 'toc-item'} type="button" key={item}>
              {item}
            </button>
          ))}
          <button className="add-section" type="button">＋ 添加章节</button>
        </aside>

        <article className="editor-panel">
          <nav className="editor-tabs">
            {['赛评内容', '评价与复盘', '相关资料', '训练记录'].map((tab, index) => (
              <button className={index === 0 ? 'tab tab--active' : 'tab'} type="button" key={tab}>{tab}</button>
            ))}
          </nav>
          <div className="editor-toolbar">
            {[Bold, Italic, Underline, List, List, Quote, Link2, Image, Undo2, Redo2].map((Icon, index) => (
              <button type="button" key={`${Icon.name}-${index}`}><Icon size={18} /></button>
            ))}
          </div>
          <h3>我的赛评内容</h3>
          <div className="writing-box">
            <p>语言不仅是信息传递的工具，更是思想的边界。</p>
            <p>人类通过语言构建概念、区分世界、进行抽象思考。</p>
            <p>动物虽然有交流系统，但不具备真正的语义层次和递归结构。</p>
            <p>因此，语言的边界，确实在极大程度上定义了人类的认知边界。</p>
          </div>
          <section className="prose-block">
            <h3>核心观点</h3>
            <ul>
              <li>语言是思想的载体，决定了人类认知的深度和广度。</li>
              <li>动物交流系统缺乏语法和递归，无法支持复杂思维。</li>
              <li>语言的演化推动了文明的发展与知识的积累。</li>
            </ul>
          </section>
        </article>

        <aside className="related-panel">
          <h2>关联训练（2）</h2>
          {[1, 2].map((item) => (
            <div className="training-mini" key={item}>
              <strong>训练{item}</strong>
              <span>2026-06-04 12:2{item}</span>
              <p>{item === 1 ? '保留开头的判断句，...' : '下把结束压到20秒内...'}</p>
              <SketchTag className="tag-blue">语言边界</SketchTag>
              <SketchButton as={Link} to="/trainings/training-001" variant="secondary">查看训练</SketchButton>
            </div>
          ))}
          <SketchButton as={Link} to={`/trainings/new?reviewId=${review?.id ?? 'review-001'}`} variant="secondary">＋ 关联更多训练</SketchButton>
        </aside>
      </section>
    </ContentLayout>
  )
}
