import { CalendarDays, Clock, ExternalLink, Lightbulb, Link2, Mic, Pause, Square, Video } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { WorkbenchHeader } from '../design-system/layout/WorkbenchHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { SketchTag } from '../design-system/ui/SketchTag.jsx'

export default function TrainingCreatePage() {
  const [searchParams] = useSearchParams()
  const reviewId = searchParams.get('reviewId')

  return (
    <ContentLayout>
      <WorkbenchHeader
        eyebrow="新国辩数据库 / 训练 / AI 的迅猛发展提升了 / 降低了人类创作者存在的意义"
        hero="training-create"
        title="训练档案"
        variant="compact"
      />

      <section className="practice-grid">
        <div className="practice-main">
          <article className="match-context-card">
            <SketchTag className="tag-blue">已完成比赛</SketchTag>
            <p>香港大学 vs 北京师范大学</p>
            <h2>AI的迅猛发展提升了 / 降低了人类创作者存在的意义</h2>
            <div className="inline-meta">
              <span><CalendarDays size={16} />2026-01-24</span>
              <span><Clock size={16} />02:07:09</span>
              <span>新国辩半决赛</span>
            </div>
          </article>

          <div className="mode-row">
            <span>训练模式：</span>
            <button className="pill pill--active" type="button"><Mic size={16} />录音训练</button>
            <button className="pill" type="button"><Video size={16} />录像训练</button>
          </div>

          <article className="recorder-card">
            <h2>正在录音</h2>
            <div className="recording-line">
              <span className="record-dot" />
              <strong>01:26</strong>
              <Waveform />
            </div>
            <p className="recording-hint">正在采集声音，请继续陈词...</p>
            <div className="recorder-actions">
              <SketchButton variant="secondary"><Pause size={18} />暂停</SketchButton>
              <SketchButton className="danger-button"><Square size={16} />停止录制</SketchButton>
              <SketchButton variant="secondary">取消</SketchButton>
            </div>
          </article>
        </div>

        <aside className="practice-side">
          <section className="hint-card">
            <h2><Lightbulb size={20} />训练提示</h2>
            <ul>
              <li>控制语速</li>
              <li>首段立场要明确</li>
              <li>结尾注意收束</li>
            </ul>
          </section>
          <section className="linked-review-card">
            <h2><Link2 size={20} />关联赛评</h2>
            <div className="linked-paper">
              <SketchTag className="tag-blue">{reviewId ? '已关联赛评' : '已发布赛评'}</SketchTag>
              <span>2026-06-04 12:22</span>
              <strong>AI的迅猛发展提升了 / 降低了人类创作者存在的意义</strong>
              <p>香港大学 vs 北京师范大学</p>
              <SketchButton as={Link} to="/reviews/review-001" variant="secondary">查看赛评 <ExternalLink size={16} /></SketchButton>
            </div>
          </section>
        </aside>
      </section>

      <section className="history-strip">
        <div className="section-head section-head--flat">
          <h2>历史训练记录</h2>
          <Link to="/trainings">查看全部 ›</Link>
        </div>
        {[
          ['录音', '2026-06-04 11:30', '02:48'],
          ['录像', '2026-06-03 20:15', '03:21'],
        ].map((row) => (
          <article className="history-row" key={row[1]}>
            <span>{row[0]}</span>
            <span>{row[1]}</span>
            <SketchTag className={row[0] === '录音' ? 'tag-blue' : 'tag-green'}>{row[0]}</SketchTag>
            <span>时长 {row[2]}</span>
            <span>主题：AI的迅猛发展提升了 / 降低了人类创作者存在的意义</span>
            <SketchButton as={Link} to="/trainings/training-001" variant="secondary">查看训练 <ExternalLink size={16} /></SketchButton>
          </article>
        ))}
      </section>
    </ContentLayout>
  )
}

function Waveform() {
  const bars = [12, 28, 42, 30, 56, 72, 44, 24, 18, 62, 88, 64, 30, 20, 46, 74, 96, 52, 38, 70, 84, 56, 40, 26, 16, 12, 32, 58, 36]

  return (
    <div className="waveform" aria-hidden="true">
      {bars.map((height, index) => (
        <i className={index > 13 && index < 21 ? 'wave-bar wave-bar--active' : 'wave-bar'} style={{ height }} key={`${height}-${index}`} />
      ))}
    </div>
  )
}
