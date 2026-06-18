import { Eye, Plus, RotateCcw } from 'lucide-react'
import { Link } from 'react-router'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { WorkbenchHeader } from '../design-system/layout/WorkbenchHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { SketchTag } from '../design-system/ui/SketchTag.jsx'

const trainingRows = [
  ['2026-01-24', '02:07', '录音', '香港大学', '北京师范大学', '整体思路清晰，开篇立论稳健，但反驳环节论证深度不足，可加强对方核心论点的拆解。'],
  ['2026-01-18', '15:42', '录音', '新加坡国立大学', '复旦大学', '语言表达流畅，例证丰富，有说服力，但结尾总结较弱，建议强化升华与呼吁。'],
  ['2026-01-14', '21:33', '录像', '清华大学', '中央戏剧学院', '肢体语言自然，节奏把控较好，论点展开扎实，可在情绪起伏上再加强。'],
  ['2026-01-10', '19:08', '录像', '香港中文大学', '浙江大学', '前半段论证强势，但中段出现重复论据，时间分配不均，建议优化结构安排。'],
]

export default function TrainingsPage() {
  return (
    <ContentLayout>
      <WorkbenchHeader
        actions={<SketchButton as={Link} to="/trainings/new"><Plus size={18} />创建训练</SketchButton>}
        eyebrow="新国辩数据库 / 赛评 / 训练"
        hero="trainings"
        title="练习室"
      />

      <section className="training-board">
        <div className="section-head">
          <h2>过去的训练</h2>
          <div className="pill-row">
            {['全部', '录音', '录像', '最近关联⌄'].map((item, index) => (
              <button className={index === 0 ? 'pill pill--active' : 'pill'} type="button" key={item}>{item}</button>
            ))}
          </div>
        </div>

        <div className="training-list">
          {trainingRows.map((row) => (
            <article className="training-row" key={`${row[0]}-${row[1]}`}>
              <div className="training-time">
                <span>{row[0]}</span>
                <span>{row[1]}</span>
              </div>
              <div className="training-summary">
                <div className="training-title-row">
                  <SketchTag className={row[2] === '录像' ? 'tag-yellow' : 'tag-blue'}>{row[2]}</SketchTag>
                  <h2>{row[3]} <span>vs</span> {row[4]}</h2>
                </div>
                <p>{row[5]}</p>
                <p className="muted">关联赛评：AI 的迅猛发展提升了 / 降低了人类创作者存在的意义</p>
              </div>
              <div className="training-actions">
                <SketchButton as={Link} to="/trainings/training-001" variant="secondary"><Eye size={18} />查看训练</SketchButton>
                <SketchButton as={Link} to="/trainings/new?reviewId=review-001" variant="secondary"><RotateCcw size={18} />再次训练</SketchButton>
              </div>
            </article>
          ))}
        </div>
      </section>
    </ContentLayout>
  )
}
