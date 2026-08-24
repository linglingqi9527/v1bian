import { useState } from 'react'
import { Scale } from 'lucide-react'
import { findOrCreateJudgeConversation } from '../judgeService.js'
import { JudgePanel } from './JudgePanel.jsx'
import '../Judge.css'

export function JudgeLauncher({ context, label = '呼出 Judge' }) {
  const [open, setOpen] = useState(false)
  const [conversationId, setConversationId] = useState('')

  function handleOpen() {
    const result = findOrCreateJudgeConversation(context)
    setConversationId(result.conversation.id)
    setOpen(true)
  }

  return (
    <>
      <button className="sketch-button judge-launcher" onClick={handleOpen} type="button">
        <Scale size={18} />
        {label}
      </button>
      {open ? <JudgePanel conversationId={conversationId} onClose={() => setOpen(false)} /> : null}
    </>
  )
}
