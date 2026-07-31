import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { WorkbenchHeader } from '../design-system/layout/WorkbenchHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { ReviewListRow } from '../features/reviews/components/ReviewListRow.jsx'
import { createReviewItems, filterReviewItems } from '../features/reviews/reviewListUtils.js'
import { deleteReview, saveReview } from '../features/reviews/reviewService.js'
import { REVIEW_STATUS } from '../features/reviews/reviewUtils.js'

const REVIEW_TABS = ['全部', '已完成', '草稿箱', '已训练']

export default function ReviewsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(REVIEW_TABS[0])
  const [searchQuery, setSearchQuery] = useState('')
  const activePriority = searchParams.get('priority') || 'all'
  const [reviewItems, setReviewItems] = useState(() => createReviewItems())
  const filteredReviews = useMemo(
    () => filterReviewItems(reviewItems, activeTab, activePriority, searchQuery),
    [activePriority, activeTab, reviewItems, searchQuery],
  )
  const completedCount = reviewItems.filter((item) => item.status === REVIEW_STATUS.completed).length
  const draftCount = reviewItems.filter((item) => item.status === REVIEW_STATUS.draft).length
  const trainedCount = reviewItems.filter((item) => item.trainingCount > 0).length

  function updatePriorityFilter(priority) {
    const nextParams = new URLSearchParams(searchParams)
    if (priority === 'all') {
      nextParams.delete('priority')
    } else {
      nextParams.set('priority', priority)
    }
    setSearchParams(nextParams)
  }

  function handleTabChange(tab) {
    setActiveTab(tab)
    if (tab === '全部') {
      updatePriorityFilter('all')
    }
  }

  function handlePriorityChange(reviewId, priority) {
    saveReview({ id: reviewId, priority })
    setReviewItems(createReviewItems())
  }

  function handleDeleteReview(item) {
    const confirmed = window.confirm(`确定删除「${item.title}」吗？\n删除赛评不会删除关联训练。`)
    if (!confirmed) return

    deleteReview(item.id)
    setReviewItems((current) => current.filter((review) => review.id !== item.id))
  }

  return (
    <ContentLayout>
      <div className="reviews-font-trial">
        <WorkbenchHeader
          actions={<SketchButton as={Link} to="/reviews/new/edit">新建赛评</SketchButton>}
          hero="reviews"
          title="观赛日志"
          meta={`共 ${reviewItems.length} 篇 · 已完成 ${completedCount} 篇 · 草稿 ${draftCount} 篇 · 已训练 ${trainedCount} 篇`}
        />

        <section className="compact-toolbar">
          <label className="search-box search-box--small">
            <Search size={20} />
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索赛评标题、比赛、学校..."
              value={searchQuery}
            />
          </label>
        </section>

        <section className="review-board">
          <nav className="tabs" aria-label="赛评筛选">
            {REVIEW_TABS.map((tab) => (
              <button
                className={tab === activeTab ? 'tab tab--active handdrawn-underline handdrawn-underline--tab' : 'tab'}
                onClick={() => handleTabChange(tab)}
                type="button"
                key={tab}
              >
                {tab}
              </button>
            ))}
          </nav>
          <div className="review-list">
            {filteredReviews.map((item) => (
              <ReviewListRow
                item={item}
                onDelete={handleDeleteReview}
                onPriorityChange={handlePriorityChange}
                key={item.id}
              />
            ))}
          </div>
          <p className="review-board-footer">{filteredReviews.length > 0 ? '没有更多赛评啦 :)' : '这里还没有对应赛评'}</p>
        </section>
      </div>
    </ContentLayout>
  )
}
