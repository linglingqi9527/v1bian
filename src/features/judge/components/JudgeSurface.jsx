import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileAudio,
  FileText,
  FileVideo,
  SendHorizontal,
  Trash2,
} from 'lucide-react'
import { imageAssets } from '../../../assets/assetPaths.js'
import { AUTH_UPDATED_EVENT } from '../../auth/authService.js'
import { LOCAL_LIBRARY_UPDATED_EVENT } from '../../storage/localLibraryService.js'
import { transcribeJudgeVideo } from '../agent/judgeTranscriptService.js'
import { getJudgeContextVideoSource, resolveJudgeContext } from '../judgeContextResolver.js'
import {
  appendJudgeQuestion,
  appendJudgeRun,
  createJudgeConversationFromFile,
  deleteJudgeConversation,
  getJudgeConversationById,
  JUDGE_UPDATED_EVENT,
  listJudgeConversations,
} from '../judgeService.js'
import { SketchButton } from '../../../design-system/ui/SketchButton.jsx'
import '../Judge.css'

const ACCEPTED_FILE_TYPES = [
  'text/*',
  '.txt',
  '.md',
  '.srt',
  '.vtt',
  '.json',
  '.docx',
  '.pdf',
  'audio/*',
  'video/*',
]

const JUDGE_MODEL_OPTIONS = [
  { value: 'default', label: '高', provider: 'api-proxy' },
  { value: 'fast', label: '快', provider: 'api-proxy' },
  { value: 'local', label: '本地', provider: 'api-proxy' },
]

const JUDGE_DEMO_PREVIEW_OUTPUT = {
  id: 'judge-demo-preview-output',
  title: '比赛 · AI的迅猛发展提升了 / 降低了人类创作者存在的意义',
  summary: '案例预览：正方胜，胜负幅度为中胜。',
  actions: [],
  sourceRefs: ['比赛案例.docx'],
  sourceTextExcerpt: '',
  createdAt: '2026-08-23T20:30:00.000Z',
  modelProfile: 'demo',
  provider: 'demo-preview',
  reportJson: {
    source_boundary: '本评判报告基于示例转写材料生成，仅用于展示 Judge 的输出形态。材料中的角色标签按发言顺序处理；若真实材料存在缺漏或转写误差，胜负强度应相应下调。',
    fact_sheet: {
      topic: '比赛 · AI的迅猛发展提升了 / 降低了人类创作者存在的意义',
      match: '比赛 · AI的迅猛发展提升了 / 降低了人类创作者存在的意义',
      affirmative: '正方',
      negative: '反方',
    },
    core_standard: '本场核心不比“AI产业好不好”，而比正方能否把 AI 训练行为纳入合理使用框架，并回应复制权与创作者利益损害。裁判主要看三件事：第一，训练行为是否能被解释为非表达性、转换性的技术分析；第二，反方提出的复制与市场损害是否完成了从“可能存在”到“足以否定合理使用”的证明；第三，社会公共利益是否强到足以支撑合理使用条款的弹性解释。',
    final_judgment: '正方胜，胜负幅度为中胜。正方优势在于没有停留在“AI发展重要”的价值口号，而是把技术过程、法律要件和公共利益串成了一条裁判可以采信的判断链：训练不是直接替代作品消费，输出端也存在过滤和低重合率等限制，因此反方必须进一步证明具体损害。反方能够打出“记忆化”“许可权被剥夺”等有杀伤力的点，但始终缺少中国市场中作者收入、销量或授权利益受损的具体链条，导致攻势更像风险提示，而不是能直接推翻合理使用的终局论证。',
    winner: 'affirmative',
    win_margin: 'medium',
    main_clashes: [
      {
        title: 'AI训练的法律定性：技术分析还是复制侵权',
        analysis: '正方把 AI 训练定义为对语料规律的提取，强调模型学习的是统计关系、表达结构和风格规律，而不是把原文稳定保存成可供阅读的复制件。这套说法的价值在于，它把辩题从“用了作品所以侵权”拉回到著作权法保护范围：法律保护具体表达，不保护思想、方法和风格。\n\n反方的攻击抓住“记忆化”现象，试图说明模型可以再现作品片段，所以训练端已经形成实质复制。这个攻击方向有效，因为它逼迫正方解释技术过程和法律效果之间的关系。但反方的问题是，没有证明这种再现具有普遍性、稳定性和市场替代性。裁判因此会认为：反方成功制造复制权风险，正方则更好地完成了“为什么训练行为仍可被纳入合理使用讨论”的法理转化。',
        evidence_refs: [
          { speaker: '正方一辩', quote: '训练是学习规律和风格，不是直接复制原文。' },
          { speaker: '反方一辩', quote: '模型可能记忆并输出原作品内容。' },
        ],
      },
      {
        title: '市场损害：抽象权利受损还是具体利益受损',
        analysis: '这一交锋是正方扩大优势的关键。正方持续追问反方：到底哪一类作者、哪一个市场、哪一种收益因为 AI 训练发生了可验证下降。这个追问很重要，因为合理使用的第三步不是问“权利人是否不舒服”，而是问是否不合理地损害了合法利益。\n\n反方用“许可权被剥夺”回应，逻辑上并不弱：作品被企业用于训练却没有付费，确实可能改变版权交易秩序。但反方没有把许可权损失具体化，也没有说明如果所有训练都必须逐一授权，产业、科研和中文语料供给会面临怎样的制度成本。于是这一轮裁判会给正方优势：正方不仅削弱了反方的损害证明，还把举证责任重新压回反方。',
        evidence_refs: [
          { speaker: '正方三辩', quote: '请说明哪位作者的销量或阅读量因此下降。' },
          { speaker: '反方四辩', quote: '未经许可使用作品本身就损害作者利益。' },
        ],
      },
      {
        title: '社会公共利益：国家战略是否能进入合理使用判断',
        analysis: '正方最强的一步，是把合理使用从单纯的版权抗辩推进到制度选择：中文高质量语料不足、授权链条复杂、AI 产业竞争紧迫，都意味着裁判不能只看单个作品被使用的不适感，还要看社会整体创新和知识生产的成本。\n\n反方尝试以公版数据、合规授权和国外案例回应，说明 AI 发展并不必然依赖未经许可作品。这一路径本来可以很强，但反方没有充分说明公版数据的质量、覆盖率和中文语境适配能力，也没有证明替代方案足以支撑同等规模模型训练。最终，正方在“为什么需要扩张解释合理使用”上讲出了更完整的现实理由。',
        evidence_refs: [
          { speaker: '正方三辩', quote: '中文语料供给不足会影响模型能力。' },
          { speaker: '反方三辩', quote: '公版和合规授权数据也可以训练模型。' },
        ],
      },
    ],
    final_reasons: [
      '**第一，正方完成了法律闭环。**它没有只讲 AI 有用，而是把训练行为定性、合理使用三步检验、输出端风险控制放在同一条链条里，使裁判能够理解为什么“使用作品”不必然等于“侵权成立”。',
      '**第二，反方的风险提示强，但终局证明不足。**记忆化、许可权和创作者利益都是有效攻击点，可反方没有把这些点落实到具体市场损害或可衡量利益下降，导致其论证停留在“可能侵害”而非“足以否定合理使用”。',
      '**第三，正方的公共利益论证更能解释制度取舍。**当正方把中文语料、国家 AI 战略和授权成本纳入判断，裁判会认为合理使用条款有必要保留技术时代的弹性空间。',
    ],
    best_debater: {
      speaker: '正方一辩',
      side: '正方',
      key_contribution: '正方一辩承担了本场胜负的地基工作：开篇先把比赛压到合理使用三步检验上，再把 AI 训练解释为非表达性技术分析，使后续队友的质询和小结都有明确裁判坐标。',
      reason: '她决定胜局的地方不在于某一句话压倒对手，而在于提前搭好了“法律要件、市场损害、公共利益”的三层框架。反方之后虽然不断攻击复制风险，但每一次都必须回到正方设置的判准里回答，比赛节奏因此长期由正方掌握。',
      confidence: '高置信',
    },
  },
  markdown: '',
}

export function JudgeSurface({ conversationId = '', mode = 'page', onBackToList, onConversationUpdated }) {
  const [conversation, setConversation] = useState(() => getConversation(conversationId))
  const [demoPreviewOutput, setDemoPreviewOutput] = useState(null)
  const [directoryItems, setDirectoryItems] = useState(() => listJudgeConversations())
  const [prompt, setPrompt] = useState('')
  const [fileState, setFileState] = useState(null)
  const [error, setError] = useState('')
  const [filesOpen, setFilesOpen] = useState(false)
  const [downloadsOpen, setDownloadsOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [runProgress, setRunProgress] = useState(0)
  const [runStartedAt, setRunStartedAt] = useState(0)
  const [runProgressMode, setRunProgressMode] = useState('report')
  const [runError, setRunError] = useState('')
  const [modelProfile, setModelProfile] = useState(() => getDefaultJudgeModelProfile())
  const fileInputRef = useRef(null)

  useEffect(() => {
    function refreshConversation() {
      setConversation((current) => getConversation(conversationId || current?.id || ''))
      setDirectoryItems(listJudgeConversations())
    }

    refreshConversation()
    window.addEventListener(JUDGE_UPDATED_EVENT, refreshConversation)
    window.addEventListener(AUTH_UPDATED_EVENT, refreshConversation)
    window.addEventListener(LOCAL_LIBRARY_UPDATED_EVENT, refreshConversation)
    return () => {
      window.removeEventListener(JUDGE_UPDATED_EVENT, refreshConversation)
      window.removeEventListener(AUTH_UPDATED_EVENT, refreshConversation)
      window.removeEventListener(LOCAL_LIBRARY_UPDATED_EVENT, refreshConversation)
    }
  }, [conversationId])

  useEffect(() => {
    if (!running || !runStartedAt) return undefined

    const timer = window.setInterval(() => {
      const elapsedMs = Date.now() - runStartedAt
      const nextProgress = estimateJudgeProgress(elapsedMs, runProgressMode)
      setRunProgress((current) => Math.max(current, nextProgress))
    }, 420)

    return () => window.clearInterval(timer)
  }, [runProgressMode, runStartedAt, running])

  const latestOutput = demoPreviewOutput ?? conversation?.outputs?.at(-1)
  const isDemoPreview = Boolean(demoPreviewOutput)
  const messages = conversation?.messages ?? []
  const followUpMessages = messages.filter((message) => message.kind === 'question' || message.kind === 'answer')
  const resolvedConversationContext = conversation ? resolveConversationContext(conversation) : null
  const conversationVideoSource = getJudgeContextVideoSource(resolvedConversationContext)
  const canStartFromContextVideo = Boolean(conversation && !latestOutput && conversationVideoSource.url)

  function handleSelectFile() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    const fileKind = getJudgeFileKind(file)
    if (!fileKind) {
      setFileState(null)
      setError('目前只支持导入文字、音频或视频文件。')
      event.target.value = ''
      return
    }

    setError('')
    setDemoPreviewOutput(null)
    setFileState({
      kind: fileKind,
      name: file.name,
      size: file.size,
      sourceText: '',
      status: 'reading',
    })

    try {
      const sourceText = await readJudgeSourceText(file, fileKind)
      const readyFileState = {
        kind: fileKind,
        name: file.name,
        size: file.size,
        sourceText,
        status: sourceText ? 'ready' : 'empty',
      }
      setFileState(readyFileState)
    } catch (fileError) {
      setFileState(null)
      setError(fileError instanceof Error ? fileError.message : '文件读取失败。')
    } finally {
      event.target.value = ''
    }
  }

  async function handleRun() {
    if (running) return

    if (conversation?.outputs?.length) {
      await runJudgeQuestion(prompt)
      return
    }

    const normalizedPrompt = prompt.trim()
      || (fileState ? `请分析我导入的${getFileKindLabel(fileState.kind)}：${fileState.name}` : '')
      || (canStartFromContextVideo ? createContextVideoPrompt(resolvedConversationContext, conversationVideoSource) : '')
    if (!normalizedPrompt) return
    if (fileState?.status === 'reading') {
      setRunError('文件还在读取，稍等一下再发送。')
      return
    }
    if (fileState?.status === 'empty') {
      setRunError('这个文件没有读出正文，请换成带文字内容的 .docx 或 .txt。')
      return
    }

    if (!fileState && canStartFromContextVideo) {
      await runJudgeWithContextVideo(normalizedPrompt)
      return
    }

    await runJudgeWithFile(fileState, normalizedPrompt)
  }

  async function runJudgeWithContextVideo(promptText = '') {
    if (!conversation || running) return

    const context = resolveConversationContext(conversation)
    const videoSource = getJudgeContextVideoSource(context)
    if (!videoSource.url) {
      setRunError('当前比赛没有可转写的视频链接。')
      return
    }

    startJudgeProgress('transcript')
    setRunError('')
    let completed = false
    try {
      const transcript = await transcribeJudgeVideo({
        bvId: videoSource.bvId,
        matchId: context.matchId,
        speakerGroups: videoSource.speakerGroups,
        title: videoSource.title,
        videoUrl: videoSource.url,
      })
      const transcriptFileState = {
        kind: 'text',
        name: `${videoSource.title || context.sourceLabel || '当前比赛'}转写稿`,
        size: transcript.text.length,
        sourceText: transcript.text,
        status: 'ready',
      }

      setFileState(transcriptFileState)
      startJudgeProgress('report')
      setRunProgress((current) => Math.max(current, 42))

      const result = await appendJudgeRun(conversation.id, promptText, {
        modelProfile,
        provider: getProviderByModelProfile(modelProfile),
        sourceText: transcriptFileState.sourceText,
      })
      if (result?.conversation) {
        setConversation(result.conversation)
        onConversationUpdated?.(result.conversation)
        setPrompt('')
      } else {
        throw new Error('JudgeAgent 没有返回有效结果。')
      }
      completed = true
    } catch (agentError) {
      setRunError(agentError instanceof Error ? agentError.message : '视频转文字或 JudgeAgent 运行失败。')
      stopJudgeProgress()
    } finally {
      if (completed) {
        await completeJudgeProgress()
      }
    }
  }

  async function runJudgeWithFile(fileContext, promptText = '') {
    const normalizedPrompt = promptText.trim() || (fileContext ? `请分析我导入的${getFileKindLabel(fileContext.kind)}：${fileContext.name}` : '')
    if (!normalizedPrompt || running) return

    startJudgeProgress('report')
    setRunError('')
    let completed = false
    try {
      const activeConversation = conversation ?? createJudgeConversationFromFile(fileContext)
      if (!activeConversation?.id) {
        throw new Error('请先登录并连接本地资料包后再保存 Judge 记录。')
      }

      const result = await appendJudgeRun(activeConversation.id, normalizedPrompt, {
        modelProfile,
        provider: getProviderByModelProfile(modelProfile),
        sourceText: fileContext?.sourceText ?? '',
      })
      if (result?.conversation) {
        setConversation(result.conversation)
        onConversationUpdated?.(result.conversation)
        setPrompt('')
      } else {
        throw new Error('JudgeAgent 没有返回有效结果。')
      }
      completed = true
    } catch (agentError) {
      setRunError(agentError instanceof Error ? agentError.message : 'JudgeAgent 运行失败。')
      stopJudgeProgress()
    } finally {
      if (completed) {
        await completeJudgeProgress()
      }
    }
  }

  async function runJudgeQuestion(promptText) {
    const normalizedPrompt = promptText.trim()
    if (!normalizedPrompt || running || !conversation) return

    startJudgeProgress('chat')
    setRunError('')
    let completed = false
    try {
      const result = await appendJudgeQuestion(conversation.id, normalizedPrompt, {
        modelProfile,
        provider: getProviderByModelProfile(modelProfile),
        sourceText: fileState?.sourceText ?? '',
      })
      if (result?.conversation) {
        setConversation(result.conversation)
        onConversationUpdated?.(result.conversation)
        setPrompt('')
      } else {
        throw new Error('JudgeAgent 没有返回有效回答。')
      }
      completed = true
    } catch (agentError) {
      setRunError(agentError instanceof Error ? agentError.message : 'JudgeAgent 追问失败。')
      stopJudgeProgress()
    } finally {
      if (completed) {
        await completeJudgeProgress()
      }
    }
  }

  function startJudgeProgress(modeName) {
    setRunProgressMode(modeName)
    setRunStartedAt(Date.now())
    setRunProgress(modeName === 'chat' ? 14 : 8)
    setRunning(true)
  }

  async function completeJudgeProgress() {
    setRunProgress(100)
    await wait(360)
    setRunning(false)
    setRunStartedAt(0)
    setRunProgress(0)
  }

  function stopJudgeProgress() {
    setRunning(false)
    setRunStartedAt(0)
    setRunProgress(0)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleRun()
    }
  }

  function handleBackToList() {
    if (onBackToList) {
      onBackToList()
      return
    }

    setConversation(null)
    setDemoPreviewOutput(null)
    setFileState(null)
    setPrompt('')
    setRunError('')
  }

  function handleSelectDirectoryItem(item) {
    setFilesOpen(false)
    setDemoPreviewOutput(null)
    if (item?.id) {
      setConversation(getJudgeConversationById(item.id))
      setPrompt('')
      setRunError('')
    }
  }

  function handleDeleteDirectoryItem(item) {
    if (!item?.id) return

    const nextItems = deleteJudgeConversation(item.id)
    setDirectoryItems(nextItems)
    if (item.id === conversation?.id) {
      setConversation(null)
      setFileState(null)
      setPrompt('')
      setRunError('')
    }
  }

  function handleDemoPreview() {
    setFilesOpen(false)
    setDownloadsOpen(false)
    setConversation(null)
    setDemoPreviewOutput(JUDGE_DEMO_PREVIEW_OUTPUT)
    setFileState(null)
    setPrompt('')
    setError('')
    setRunError('')
  }

  function renderContextBar() {
    return (
      <div className="judge-chat-context">
        <button className="judge-back-button" onClick={handleBackToList} type="button">
          <ArrowLeft size={18} />
          返回列表
        </button>
        <div className="judge-context-files">
          <button
            aria-expanded={filesOpen}
            className="judge-files-trigger"
            onClick={() => setFilesOpen((current) => !current)}
            type="button"
          >
            目录
            <span>{directoryItems.length}</span>
            <ChevronDown size={18} />
          </button>
          {filesOpen ? (
            <div className="judge-files-menu" role="menu">
              <div className="judge-files-menu-head">
                <strong>Judge 目录</strong>
                <small>按导入材料查看已经生成的判断文档</small>
              </div>
              {directoryItems.length ? (
                directoryItems.map((item) => (
                  <div
                    className={`judge-file-row ${item.id === conversation?.id ? 'judge-file-row--active' : ''}`}
                    key={item.id}
                  >
                    <button
                      className="judge-file-open"
                      onClick={() => handleSelectDirectoryItem(item)}
                      role="menuitem"
                      type="button"
                    >
                      <FileText size={18} />
                      <span>{item.sourceLabel || item.title}</span>
                      <small>{item.outputs?.length ? '已生成' : '会话'}</small>
                    </button>
                    <button
                      aria-label={`删除 ${item.sourceLabel || item.title}`}
                      className="judge-file-delete"
                      onClick={() => handleDeleteDirectoryItem(item)}
                      title="删除"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="judge-empty-note">还没有生成判断文档。</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  function renderDemoPreviewButton() {
    return (
      <div className="judge-demo-preview-row">
        <SketchButton
          className="judge-demo-preview-button"
          handdrawnFill={false}
          onClick={handleDemoPreview}
          size="sm"
          type="button"
          variant="secondary"
        >
          案例预览
        </SketchButton>
      </div>
    )
  }

  if (!conversation && !demoPreviewOutput) {
    const importStageClassName = running
      ? 'judge-import-stage judge-import-stage--docked'
      : 'judge-import-stage judge-import-stage--center'

    return (
      <section className={`judge-surface judge-surface--${mode} judge-file-stage`} aria-label="Judge 文件导入">
        {renderContextBar()}
        {renderDemoPreviewButton()}
        <div className={importStageClassName}>
          <div className={fileState ? 'judge-composer judge-composer--with-file judge-import-composer' : 'judge-composer judge-import-composer'}>
            <button
              className="judge-composer-plus"
              onClick={handleSelectFile}
              title={fileState ? `${fileState.name} · ${getFileKindLabel(fileState.kind)}` : '导入文字、音频或视频'}
              type="button"
              aria-label="导入文字、音频或视频"
            >
              ＋
            </button>
            {fileState ? (
              <span className={`judge-file-inline judge-file-inline--${fileState.status}`}>
                {fileState.status === 'reading' ? '读取中' : getFileKindLabel(fileState.kind)}
                <strong>{fileState.name}</strong>
              </span>
            ) : null}
            <span className="judge-import-placeholder">
              {fileState ? (running ? '正在生成第一份判断文档' : '已导入，点击发送生成') : '导入文件'}
            </span>
            <label className="judge-model-inline">
              <select aria-label="选择 Judge 模型" onChange={(event) => setModelProfile(event.target.value)} value={modelProfile}>
                {JUDGE_MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </label>
            <button
              className="judge-composer-send"
              disabled={!fileState || running || fileState?.status === 'reading'}
              onClick={handleRun}
              type="button"
              aria-label="发送给 Judge"
            >
              <SendHorizontal size={20} />
            </button>
          </div>
          <input
            accept={ACCEPTED_FILE_TYPES.join(',')}
            className="judge-file-input"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
          <div className="judge-import-types" aria-label="可导入类型">
            <span><FileText size={18} />文字文件</span>
            <span><FileAudio size={18} />音频文件</span>
            <span><FileVideo size={18} />视频文件</span>
          </div>
          {running ? <JudgeRunProgress progress={runProgress} /> : null}
          {runError ? <p className="judge-run-error judge-run-error--inline">{runError}</p> : null}
          {error ? <p className="judge-import-error">{error}</p> : null}
        </div>
      </section>
    )
  }

  const composerClassName = [
    'judge-composer',
    fileState && 'judge-composer--with-file',
    latestOutput && 'judge-composer--floating',
  ].filter(Boolean).join(' ')

  return (
    <section
      className={`judge-surface judge-surface--${mode} judge-chat ${latestOutput ? 'judge-chat--has-output' : ''}`}
      aria-label="Judge 会话"
    >
      {renderContextBar()}
      {renderDemoPreviewButton()}

      <div className={latestOutput || messages.length > 1 ? 'judge-message-area' : 'judge-message-area judge-message-area--blank'}>
        {latestOutput ? (
          <>
            <JudgeReportPreview output={latestOutput} />
            <JudgeFollowUpMessages messages={followUpMessages} />
          </>
        ) : messages.length > 1 ? (
          messages.map((message) => (
            <article className={`judge-message judge-message--${message.role}`} key={message.id}>
              <p>{message.content}</p>
            </article>
          ))
        ) : canStartFromContextVideo ? (
          <JudgeVideoPrelude videoSource={conversationVideoSource} />
        ) : (
          <div className="judge-chat-welcome">
            <h2>有什么想让 Judge 帮你看的？</h2>
            <p>先用一句话开始。比如判断一段质询、整理赛评结构，或把训练反馈保存下来。</p>
          </div>
        )}

        {running ? <JudgeRunProgress progress={runProgress} /> : null}
        {runError ? (
          <p className="judge-run-error judge-run-error--inline">{runError}</p>
        ) : null}
      </div>

      <div className={composerClassName}>
        <button
          className="judge-composer-plus"
          onClick={handleSelectFile}
          title={fileState ? `${fileState.name} · ${getFileKindLabel(fileState.kind)}` : '导入文字、音频或视频'}
          type="button"
          aria-label="导入文字、音频或视频"
        >
          ＋
        </button>
        {fileState ? (
          <span className={`judge-file-inline judge-file-inline--${fileState.status}`}>
            {fileState.status === 'reading' ? '读取中' : getFileKindLabel(fileState.kind)}
            <strong>{fileState.name}</strong>
          </span>
        ) : null}
        <textarea
          disabled={isDemoPreview}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isDemoPreview ? '案例预览不写入账号，导入材料后可继续追问' : (canStartFromContextVideo && !fileState ? '转写当前比赛并生成' : '问问 Judge')}
          rows={1}
          value={prompt}
        />
        <label className="judge-model-inline">
          <select aria-label="选择 Judge 模型" onChange={(event) => setModelProfile(event.target.value)} value={modelProfile}>
            {JUDGE_MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown size={16} />
        </label>
        <button
          className="judge-composer-send"
          disabled={running || (latestOutput ? !prompt.trim() : (!prompt.trim() && !fileState && !canStartFromContextVideo))}
          onClick={handleRun}
          type="button"
          aria-label="发送给 Judge"
        >
          <SendHorizontal size={20} />
        </button>
      </div>
      <input
        accept={ACCEPTED_FILE_TYPES.join(',')}
        className="judge-file-input"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />

      <div className="judge-download">
        <button
          aria-expanded={downloadsOpen}
          className="judge-download-trigger"
          onClick={() => setDownloadsOpen((current) => !current)}
          type="button"
        >
          <Download size={20} />
        </button>
        {downloadsOpen ? (
          <div className="judge-download-menu">
            <div>
              <strong>近期下载</strong>
              <button type="button">清空</button>
            </div>
            {latestOutput ? (
              <button className="judge-download-item" type="button">
                <FileText size={22} />
                <span>
                  <strong>{latestOutput.title}</strong>
                  <small>Judge 分析结果 · 可导出</small>
                </span>
              </button>
            ) : (
              <p className="judge-empty-note">生成结果后会出现在这里。</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function JudgeRunProgress({ progress }) {
  const normalizedProgress = Math.max(4, Math.min(100, Number(progress) || 4))

  return (
    <div className="judge-run-progress" role="progressbar" aria-label="Judge 正在生成报告" aria-live="polite" aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(normalizedProgress)}>
      <span style={{ width: `${normalizedProgress}%` }} />
    </div>
  )
}

function JudgeVideoPrelude({ videoSource }) {
  return (
    <div className="judge-chat-welcome judge-video-prelude">
      <h2>先把这场比赛转成文字稿</h2>
      <p>{videoSource.title || videoSource.sourceLabel || '当前比赛'} 已接入视频；点击发送后，Judge 会先转写，再生成第一份判断文档。</p>
    </div>
  )
}

function JudgeFollowUpMessages({ messages }) {
  if (!messages.length) return null

  return (
    <section className="judge-followups" aria-label="Judge 追问会话">
      {messages.map((message) => (
        <article className={`judge-followup judge-followup--${message.role}`} key={message.id}>
          <JudgeChatMarkdown text={message.content} />
        </article>
      ))}
    </section>
  )
}

function JudgeChatMarkdown({ text }) {
  const blocks = createChatBlocks(text)
  if (!blocks.length) return null

  return blocks.map((block, index) => {
    const key = `${block.type}-${block.text}-${index}`

    if (block.type === 'heading') {
      return (
        <h5 key={key}>
          <InlineMarkedText text={block.text} />
        </h5>
      )
    }

    if (block.type === 'list') {
      return (
        <p className="judge-chat-list-line" key={key}>
          <InlineMarkedText text={block.text} />
        </p>
      )
    }

    return (
      <p key={key}>
        <InlineMarkedText text={block.text} />
      </p>
    )
  })
}

function JudgeReportPreview({ output }) {
  const report = output.reportJson ?? {}
  const factSheet = report.fact_sheet ?? {}
  const clashes = Array.isArray(report.main_clashes) ? report.main_clashes : []
  const finalReasons = Array.isArray(report.final_reasons) ? report.final_reasons : []
  const bestDebater = report.best_debater && typeof report.best_debater === 'object' ? report.best_debater : null

  return (
    <article className="judge-report-preview" aria-label="Judge 可视化报告">
      <header className="judge-report-head">
        <div>
          <span className="judge-report-kicker">Judge 评判报告</span>
          <h3>{factSheet.topic || output.title || 'AIB'}</h3>
          <p>{factSheet.match || output.title || '基于当前材料生成'}</p>
        </div>
      </header>

      <JudgeVerdictVisual report={report} />

      {report.source_boundary ? (
        <p className="judge-report-paragraph judge-boundary">
          <InlineMarkedText text={report.source_boundary} />
        </p>
      ) : null}

      <section className="judge-report-section">
        <h4>一、本场核心判准</h4>
        <p><InlineMarkedText text={report.core_standard || '材料不足，暂无法确认本场核心判准。'} /></p>
      </section>

      <section className="judge-report-section">
        <h4>二、终局判断</h4>
        <p>
          <strong>{getWinnerLabel(report.winner)}</strong>
          <span>，胜负幅度为 </span>
          <strong>{getMarginLabel(report.win_margin)}</strong>
          <span>。</span>
        </p>
        {report.final_judgment ? (
          <p><InlineMarkedText text={report.final_judgment} /></p>
        ) : null}
      </section>

      {clashes.length ? (
        <section className="judge-report-section judge-clash-list" aria-label="主要论述与攻防">
          <h4>三、主要论述与攻防整理</h4>
          {clashes.slice(0, 5).map((clash, index) => (
            <JudgeClashCard clash={clash} index={index} key={`${getPlainText(clash)}-${index}`} />
          ))}
        </section>
      ) : null}

      <JudgeMiniList title="四、终局判决理由" items={finalReasons} fallback="暂无完整终局理由。" />
      <JudgeBestDebater bestDebater={bestDebater} />

      <div className="judge-output-actions">
        {output.actions.map((action) => (
          <button className="sketch-button sketch-button--secondary sketch-button--sm" type="button" key={action}>
            {action}
          </button>
        ))}
      </div>
    </article>
  )
}

function JudgeVerdictVisual({ report }) {
  const verdict = createVerdictVisualModel(report)
  const bestDebaterLabel = getBestDebaterLabel(report.best_debater)

  return (
    <section className="judge-verdict-visual" aria-label="Judge 胜负可视化">
      <div className="judge-verdict-side judge-verdict-side--winner">
        <span>胜方</span>
        <strong>{verdict.winnerLabel}</strong>
        <small>{verdict.winnerPercent}%</small>
      </div>
      <div className="judge-verdict-center">
        <img alt="" src={imageAssets.judge.sword} />
        <span>{bestDebaterLabel}</span>
      </div>
      <div className="judge-verdict-side judge-verdict-side--loser">
        <span>负方</span>
        <strong>{verdict.loserLabel}</strong>
        <small>{verdict.loserPercent}%</small>
      </div>
      <div className="judge-verdict-ratio" aria-hidden="true">
        <span style={{ width: `${verdict.winnerPercent}%` }} />
      </div>
    </section>
  )
}

function JudgeClashCard({ clash, index }) {
  if (typeof clash === 'string') {
    return (
      <article className="judge-clash-item">
        <h5>论述{index + 1}</h5>
        <p><InlineMarkedText text={clash} /></p>
      </article>
    )
  }

  const evidenceRefs = Array.isArray(clash.evidence_refs) ? clash.evidence_refs : []
  const analysisParagraphs = getAnalysisParagraphs(clash.analysis)

  return (
    <article className="judge-clash-item">
      <h5>论述{index + 1}：{clash.title || '主要交锋'}</h5>
      {analysisParagraphs.length ? (
        analysisParagraphs.map((paragraph, paragraphIndex) => (
          <p key={`${paragraph}-${paragraphIndex}`}>
            <InlineMarkedText text={paragraph} />
          </p>
        ))
      ) : (
        <>
          <p><strong>正方主张：</strong><InlineMarkedText text={clash.affirmative_claim || '材料不足，无法确认。'} /></p>
          <p><strong>反方攻击：</strong><InlineMarkedText text={clash.negative_attack || '材料不足，无法确认。'} /></p>
          {clash.affirmative_response ? (
            <p><strong>正方回应：</strong><InlineMarkedText text={clash.affirmative_response} /></p>
          ) : null}
          <p><strong>裁判判断：</strong><InlineMarkedText text={clash.judge_decision || '材料不足，无法确认。'} /></p>
          {clash.remaining_issue ? (
            <p className="judge-clash-issue">
              <strong>残留问题：</strong><InlineMarkedText text={clash.remaining_issue} />
            </p>
          ) : null}
        </>
      )}
      {evidenceRefs.length ? (
        <div className="judge-evidence-list">
          {evidenceRefs.slice(0, 3).map((ref, refIndex) => (
            <span key={`${getPlainText(ref)}-${refIndex}`}>
              {ref.speaker || '证据'}：{stripVisibleTimestamps(ref.quote || '未摘录')}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function getAnalysisParagraphs(text) {
  const value = stripVisibleTimestamps(text || '')
  if (!value) return []

  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function JudgeMiniList({ title, items, fallback }) {
  const visibleItems = Array.isArray(items) ? items.slice(0, 8) : []

  return (
    <section className="judge-report-section judge-mini-list">
      <h4>{title}</h4>
      {visibleItems.length ? (
        <ul>
          {visibleItems.map((item, index) => (
            <li key={`${getPlainText(item)}-${index}`}>
              <InlineMarkedText text={getPlainText(item)} />
            </li>
          ))}
        </ul>
      ) : (
        <p>{fallback}</p>
      )}
    </section>
  )
}

function JudgeBestDebater({ bestDebater }) {
  if (!bestDebater?.speaker) {
    return (
      <section className="judge-report-section">
        <h4>五、本场最佳辩手</h4>
        <p>材料不足，暂无法确认本场最佳辩手。</p>
      </section>
    )
  }

  return (
    <section className="judge-report-section">
      <h4>五、本场最佳辩手</h4>
      <p>
        <strong>{bestDebater.speaker}</strong>
        {bestDebater.side ? <span>（{bestDebater.side}）</span> : null}
      </p>
      {bestDebater.key_contribution ? (
        <p><strong>关键贡献：</strong><InlineMarkedText text={bestDebater.key_contribution} /></p>
      ) : null}
      {bestDebater.reason ? (
        <p><strong>评选理由：</strong><InlineMarkedText text={bestDebater.reason} /></p>
      ) : null}
      {bestDebater.confidence ? (
        <p><strong>置信度：</strong>{bestDebater.confidence}</p>
      ) : null}
    </section>
  )
}

function InlineMarkedText({ text }) {
  const value = getPlainText(text)
  if (!value) return null

  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

function getPlainText(value) {
  if (typeof value === 'string') return stripVisibleTimestamps(value)
  if (!value || typeof value !== 'object') return ''

  return stripVisibleTimestamps([
    value.speaker || value.title || value.claim || '',
    value.advice || value.summary || value.content || value.judgment || '',
  ].filter(Boolean).join('：'))
}

function createChatBlocks(text) {
  const normalized = stripVisibleTimestamps(text)
    .replace(/\r\n/g, '\n')
    .replace(/\s+(#{2,4}\s+)/g, '\n$1')
    .replace(/\s+((?:[-*]\s+)|(?:\d+[.、]\s+))/g, '\n$1')
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line) => {
    const headingMatch = line.match(/^#{2,4}\s*(.+)$/)
    if (headingMatch) {
      return {
        type: 'heading',
        text: headingMatch[1].trim(),
      }
    }

    const listMatch = line.match(/^(?:[-*]\s+|\d+[.、]\s+)(.+)$/)
    if (listMatch) {
      return {
        type: 'list',
        text: listMatch[1].trim(),
      }
    }

    return {
      type: 'paragraph',
      text: line,
    }
  })
}

function stripVisibleTimestamps(text) {
  return String(text)
    .replace(/[（(]?\s*(?:如|例如)?\d{1,2}[:：]\d{2}(?:[:：]\d{2})?(?:\s*\/\s*\d{1,2}[:：]\d{2}(?:[:：]\d{2})?)*\s*[）)]?/g, '')
    .replace(/\s{2,}/g, ' ')
}

function getWinnerLabel(winner) {
  if (winner === 'affirmative') return '正方胜'
  if (winner === 'negative') return '反方胜'
  return '暂不判胜负'
}

function getMarginLabel(winMargin) {
  if (winMargin === 'big') return '大胜'
  if (winMargin === 'medium') return '中胜'
  if (winMargin === 'small') return '小胜'
  return '材料不足'
}

function createVerdictVisualModel(report = {}) {
  const winnerLabel = report.winner === 'negative' ? '反方' : report.winner === 'affirmative' ? '正方' : '暂未判定'
  const loserLabel = report.winner === 'negative' ? '正方' : report.winner === 'affirmative' ? '反方' : '另一方'
  const winnerPercent = getWinnerPercent(report.win_margin, report.winner)

  return {
    winnerLabel,
    loserLabel,
    winnerPercent,
    loserPercent: 100 - winnerPercent,
    marginLabel: getMarginLabel(report.win_margin),
  }
}

function getWinnerPercent(winMargin, winner) {
  if (winner !== 'affirmative' && winner !== 'negative') return 50
  if (winMargin === 'big') return 75
  if (winMargin === 'medium') return 65
  if (winMargin === 'small') return 55
  return 50
}

function getBestDebaterLabel(bestDebater = {}) {
  if (!bestDebater?.speaker) return '最佳辩手待确认'

  return `最佳辩手：${bestDebater.speaker}`
}

function getConversation(conversationId) {
  if (conversationId) return getJudgeConversationById(conversationId)
  return null
}

function resolveConversationContext(conversation) {
  return resolveJudgeContext({
    type: conversation?.contextType,
    matchId: conversation?.matchId,
    reviewId: conversation?.reviewId,
    trainingId: conversation?.trainingId,
  })
}

function createContextVideoPrompt(context, videoSource) {
  return `请先使用当前比赛视频转写稿，再基于转写文字生成 Judge 评判报告：${videoSource.title || context?.sourceLabel || '当前比赛'}`
}

function getJudgeFileKind(file) {
  if (file.type.startsWith('text/')) return 'text'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (['txt', 'md', 'srt', 'vtt', 'json'].includes(extension)) return 'text'
  if (['docx', 'pdf'].includes(extension)) return 'document'

  return ''
}

function getFileKindLabel(kind) {
  if (kind === 'document') return '文档'
  if (kind === 'audio') return '音频'
  if (kind === 'video') return '视频'
  return '文字'
}

function getDefaultJudgeModelProfile() {
  const configuredProfile = String(import.meta.env.VITE_JUDGE_MODEL_PROFILE ?? 'default').trim()
  return JUDGE_MODEL_OPTIONS.some((option) => option.value === configuredProfile)
    ? configuredProfile
    : 'default'
}

function getProviderByModelProfile(modelProfile) {
  return JUDGE_MODEL_OPTIONS.find((option) => option.value === modelProfile)?.provider ?? 'api-proxy'
}

function estimateJudgeProgress(elapsedMs, modeName) {
  const expectedMs = modeName === 'chat' ? 14000 : modeName === 'transcript' ? 76000 : 52000
  const ratio = Math.max(0, elapsedMs / expectedMs)

  if (ratio < 0.08) return 8 + (ratio / 0.08) * 14
  if (ratio < 0.48) return 22 + ((ratio - 0.08) / 0.4) * 38
  if (ratio < 0.82) return 60 + ((ratio - 0.48) / 0.34) * 24
  if (ratio < 1) return 84 + ((ratio - 0.82) / 0.18) * 8

  return Math.min(97, 92 + Math.log1p((ratio - 1) * 2.2) * 3.2)
}

function wait(durationMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })
}

async function readJudgeSourceText(file, fileKind) {
  if (fileKind === 'text') return await readTextFile(file)
  if (fileKind === 'document') return await extractDocumentText(file)
  return ''
}

function readTextFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    })
    reader.addEventListener('error', () => resolve(''))
    reader.readAsText(file)
  })
}

async function extractDocumentText(file) {
  const response = await fetch('/api/judge-agent/extract-text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: await file.arrayBuffer(),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || '文档正文抽取失败。')
  }

  const data = await response.json()
  return typeof data.text === 'string' ? data.text : ''
}
