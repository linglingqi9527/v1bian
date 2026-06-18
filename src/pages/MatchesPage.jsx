import { Link } from 'react-router'
import { Search } from 'lucide-react'
import { imageAssets } from '../assets/assetPaths.js'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { WorkbenchHeader } from '../design-system/layout/WorkbenchHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { SketchTag } from '../design-system/ui/SketchTag.jsx'
import { listMatches } from '../features/matches/matchService.js'

const matchRows = [
  {
    accent: 'yellow',
    duration: '02:07:09',
    event: '2026bilibili新国辩',
    stage: '高校组 初赛H组第三场',
    title: 'AI的迅猛发展提升了 / 降低了人类创作者存在的意义',
    schools: '北京大学 vs 清华大学',
    speakers: '赵一璇 李诗阳 陈耀辉 陈晓彤 吴迪 杨宇鸿 郑博中 刘孟坦',
    date: '2026-01-22',
    videoId: 'BV1pQ6UBVEBE',
    status: ['已看', '已评', '已练 3'],
    watched: true,
  },
  {
    accent: 'blue',
    duration: '02:07:09',
    event: '2026bilibili新国辩',
    stage: '高校组 半决赛第一场',
    title: '语言的边界是 / 不是人类的边界',
    schools: '香港大学 vs 北京师范大学',
    speakers: '戴纳川 柴子凡 郭仁举 严泽宇 韩劲康 许宸睿 陈凌岳 张泽铭',
    date: '2026-01-24',
    videoId: 'BV1wS6UByE5q',
    status: ['未看', '待评', '已练 0'],
  },
  {
    accent: 'green',
    duration: '01:58:00',
    event: '2026bilibili新国辩',
    stage: '初赛D组第一场',
    title: '“只筛选不改变”的心态有利于 / 不利于在感情中找到对的人',
    schools: '新南威尔士大学 vs 西南政法大学',
    speakers: '刘云鹤 孙一扬 唐可 汪嘉宁 周亦晨 林见山 陈思澄 高思远',
    date: '2026-01-21',
    videoId: 'BV1he6UBE3n',
    status: ['未看', '待评', '已练 0'],
  },
]

export default function MatchesPage() {
  const matches = listMatches()

  return (
    <ContentLayout>
      <WorkbenchHeader
        decoration={false}
        hero="matches"
        title="新国辩索引"
      />

      <section className="match-toolbar">
        <label className="search-box">
          <Search size={28} />
          <input placeholder="搜索比赛、辩题、学校、辩手..." />
        </label>
        <div className="pill-row">
          {['全部', '已看', '待写赛评', '可训练'].map((item, index) => (
            <SketchButton
              active={index === 0}
              className="pill"
              handdrawnFill={{ color: '#F7D95C', opacity: 0.46, variant: 'marker' }}
              type="button"
              variant="secondary"
              key={item}
            >
              {item}
            </SketchButton>
          ))}
        </div>
      </section>

      <section className="match-list">
        {matchRows.map((match, index) => (
          <article className="match-card" key={match.title}>
            <span className={`card-accent card-accent--${match.accent}`} />
            <aside className="match-side">
              <span className="match-side-event">{match.event.replace('bilibili', '')}</span>
              <strong>{match.stage}</strong>
            </aside>
            <div className="match-main">
              <p className="match-school">{match.schools} · {match.date} · {match.videoId}</p>
              <h2>{match.title}</h2>
              <p className="match-speakers">{match.speakers}</p>
              <div className="status-row">
                {match.status.map((tag) => (
                  <SketchTag
                    active={isStatusActive(tag)}
                    tone={getStatusTone(tag)}
                    key={tag}
                  >
                    {tag}
                  </SketchTag>
                ))}
              </div>
            </div>
            <div className="match-actions">
              <ActionLink icon={imageAssets.matchCard.watchVideo} label="观看比赛" to={`/matches/${matches[index % matches.length]?.id ?? 'match-001'}`} />
              <ActionLink
                icon={match.watched ? imageAssets.matchCard.writeReview : imageAssets.matchCard.startTraining}
                label={match.watched ? '打开赛评' : '标记已看'}
                to={`/reviews/match/${matches[index % matches.length]?.id ?? 'match-001'}/edit`}
              />
              <ActionLink icon={imageAssets.matchCard.writeReview} label="赛评入口" to="/reviews/review-001" />
            </div>
            <span className="bookmark-mark" aria-hidden="true" />
          </article>
        ))}
      </section>
    </ContentLayout>
  )
}

function ActionLink({ icon, label, to }) {
  return (
    <SketchButton
      active={label === '观看比赛'}
      as={Link}
      className="match-action-link"
      handdrawnFill={{ color: '#F7D95C', opacity: 0.44, variant: 'marker' }}
      icon={<img src={icon} alt="" />}
      to={to}
      variant="secondary"
    >
      {label}
    </SketchButton>
  )
}

function getStatusTone(status) {
  if (status.startsWith('已评')) return 'blue'
  if (status.startsWith('已练') && !status.endsWith('0')) return 'green'
  if (status === '已看') return 'yellow'
  return 'gray'
}

function isStatusActive(status) {
  return getStatusTone(status) !== 'gray'
}
