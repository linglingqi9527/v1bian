import { Download, Edit3, Eye, Filter, MoreHorizontal, Plus, Search } from 'lucide-react'
import { Link } from 'react-router'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { WorkbenchHeader } from '../design-system/layout/WorkbenchHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { SketchTag } from '../design-system/ui/SketchTag.jsx'

const reviewRows = [
  ['AI 的迅猛发展提升了 / 降低了人类创作者存在的意义', '北京大学  vs  清华大学  ·  2026-01-22', '已完成', '最后编辑：2天前', '02:07:09'],
  ['语言的边界是 / 不是人类的边界', '香港大学  vs  北京师范大学  ·  2026-01-24', '草稿', '最后编辑：1天前', '02:07:09'],
  ['“只筛选不改变”的心态有利于 / 不利于在感情中找到对的人', '新南威尔士大学  vs  西南政法大学  ·  2026-01-21', '已完成', '最后编辑：5天前', '01:58:00'],
  ['向下的自由是 / 不是自由', '西南政法大学  vs  武汉大学  ·  2026-01-20', '草稿', '最后编辑：6天前', '01:45:30'],
  ['技术中立性是 / 不是伪命题', '复旦大学  vs  南京大学  ·  2026-01-18', '已完成', '最后编辑：1周前', '01:32:11'],
]

export default function ReviewsPage() {
  return (
    <ContentLayout>
      <WorkbenchHeader
        actions={<SketchButton as={Link} to="/reviews/match/match-001/edit" variant="secondary"><Plus size={18} />新建赛评</SketchButton>}
        eyebrow="新国辩数据库 / 赛评"
        hero="reviews"
        title="我的赛评"
        meta="共 28 篇 · 已完成 23 篇 · 草稿 3 篇 · 已训练 15 篇"
      />

      <section className="compact-toolbar">
        <label className="search-box search-box--small">
          <Search size={20} />
          <input placeholder="搜索赛评标题、比赛、学校..." />
        </label>
        <button className="filter-button" type="button"><Filter size={18} />筛选</button>
      </section>

      <section className="review-board">
        <nav className="tabs" aria-label="赛评筛选">
          {['最近编辑', '已完成', '草稿箱', '已训练'].map((tab, index) => (
            <button className={index === 0 ? 'tab tab--active' : 'tab'} type="button" key={tab}>{tab}</button>
          ))}
        </nav>
        <div className="review-list">
          {reviewRows.map((row, index) => (
            <article className="review-row" key={row[0]}>
              <span className={`review-dot review-dot--${index % 2 === 0 ? 'yellow' : 'blue'}`} />
              <div className="review-row-main">
                <h2>{row[0]}</h2>
                <p className="muted">{row[1]}</p>
                <div className="mini-meta">
                  <SketchTag className={row[2] === '草稿' ? 'tag-pink' : ''}>{row[2]}</SketchTag>
                  <span>{row[3]}</span>
                </div>
              </div>
              <span className="review-duration">{row[4]}</span>
              <div className="row-actions">
                {index % 2 === 0 ? <MiniButton icon={<Eye size={16} />} label="查看" to="/reviews/review-001" /> : null}
                <MiniButton icon={<Edit3 size={16} />} label={index % 2 === 0 ? '编辑' : '继续编辑'} to="/reviews/review-001/edit" />
                {index % 2 === 0 ? <button className="mini-action" type="button"><Download size={16} />导出</button> : null}
                <button className="mini-square" type="button"><MoreHorizontal size={18} /></button>
              </div>
              <span className="bookmark-mark bookmark-mark--small" aria-hidden="true" />
            </article>
          ))}
        </div>
        <p className="board-footer">没有更多赛评啦 :)</p>
      </section>
    </ContentLayout>
  )
}

function MiniButton({ icon, label, to }) {
  return <Link className="mini-action" to={to}>{icon}{label}</Link>
}
