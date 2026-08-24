import { X } from 'lucide-react'
import { JudgeSurface } from './JudgeSurface.jsx'

export function JudgePanel({ conversationId, onClose }) {
  return (
    <div className="judge-panel-backdrop">
      <section className="judge-panel" aria-label="JudgeAgent 弹窗">
        <div className="judge-panel-head">
          <div>
            <h2>JudgeAgent</h2>
            <p>嵌入式形态，和 Judge 汇总页共用同一个会话。</p>
          </div>
          <button className="mini-square" onClick={onClose} type="button" aria-label="关闭 Judge">
            <X size={20} />
          </button>
        </div>
        <JudgeSurface conversationId={conversationId} mode="panel" onBackToList={onClose} />
      </section>
    </div>
  )
}
