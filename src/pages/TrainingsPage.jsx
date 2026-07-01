import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { ContentLayout } from '../design-system/layout/ContentLayout.jsx'
import { WorkbenchHeader } from '../design-system/layout/WorkbenchHeader.jsx'
import { SketchButton } from '../design-system/ui/SketchButton.jsx'
import { TrainingListRow } from '../features/trainings/components/TrainingListRow.jsx'
import { createTrainingItems, filterTrainingItems, TRAINING_TABS } from '../features/trainings/trainingListUtils.js'
import { saveTraining } from '../features/trainings/trainingService.js'

export default function TrainingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(TRAINING_TABS[0])
  const [searchQuery, setSearchQuery] = useState('')
  const activePriority = searchParams.get('priority') || 'all'
  const [trainingItems, setTrainingItems] = useState(() => createTrainingItems())
  const filteredTrainings = useMemo(
    () => filterTrainingItems(trainingItems, activeTab, activePriority, searchQuery),
    [activePriority, activeTab, searchQuery, trainingItems],
  )
  const audioCount = trainingItems.filter((item) => item.mode === 'audio').length
  const videoCount = trainingItems.filter((item) => item.mode === 'video').length

  function handlePriorityChange(trainingId, priority) {
    saveTraining({ id: trainingId, priority })
    setTrainingItems(createTrainingItems())
  }

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

  return (
    <ContentLayout>
      <div className="trainings-font-trial">
        <WorkbenchHeader
          actions={<SketchButton as={Link} to="/trainings/new"><Plus size={18} />创建训练</SketchButton>}
          eyebrow="新国辩数据库 / 赛评 / 训练"
          hero="trainings"
          title="练习室"
          meta={`共 ${trainingItems.length} 次 · 录音 ${audioCount} 次 · 录像 ${videoCount} 次`}
        />

        <section className="compact-toolbar">
          <label className="search-box search-box--small">
            <Search size={20} />
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索训练标题、赛评、学校..."
              value={searchQuery}
            />
          </label>
        </section>

        <section className="training-board">
          <nav className="tabs" aria-label="训练筛选">
            {TRAINING_TABS.map((tab) => (
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
          <div className="training-list">
            {filteredTrainings.map((item) => (
              <TrainingListRow
                item={item}
                onPriorityChange={handlePriorityChange}
                key={item.id}
              />
            ))}
          </div>
          <p className="training-board-footer">{filteredTrainings.length > 0 ? '没有更多训练啦 :)' : '这里还没有对应训练'}</p>
        </section>
      </div>
    </ContentLayout>
  )
}
