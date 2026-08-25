import { useState } from 'react'
import { Scale } from 'lucide-react'
import { SketchButton } from '../../../design-system/ui/SketchButton.jsx'
import { findOrCreateJudgeConversation } from '../judgeService.js'
import { JudgePanel } from './JudgePanel.jsx'
import '../Judge.css'

export function JudgeLauncher({ className = '', context, label = '呼出 Judge' }) {
  const [open, setOpen] = useState(false)
  const [conversationId, setConversationId] = useState('')

  function handleOpen() {
    const result = findOrCreateJudgeConversation(context)
    if (!result.conversation?.id) return

    setConversationId(result.conversation.id)
    setOpen(true)
  }

  return (
    <>
      <SketchButton
        active
        className={`judge-launcher ${className}`.trim()}
        handdrawnFill={{ fill: '#ffd9e3', stroke: 'transparent', strokeWidth: 0.1 }}
        icon={<Scale size={18} />}
        onClick={handleOpen}
        type="button"
        variant="secondary"
      >
        {label}
      </SketchButton>
      {open ? <JudgePanel conversationId={conversationId} onClose={() => setOpen(false)} /> : null}
    </>
  )
}
