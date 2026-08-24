import { DEMO_USER_ID } from '../../models/userModel.js'
import { createId } from '../../utils/ids.js'
import { getActiveUserId } from '../auth/authService.js'
import { getCachedLocalLibraryDb, updateActiveLocalLibraryDb } from '../storage/localLibraryService.js'
import { readLocalDb, writeLocalDb } from '../storage/localDb.js'
import { canWriteUserData, getUserDataAccessState, notifyUserDataBlocked } from '../storage/userDataAccess.js'
import { runJudgeAgent, runJudgeChatAnswer } from './agent/judgeAgentService.js'
import { createConversationDraftFromContext, JUDGE_CONTEXT_TYPES, resolveJudgeContext } from './judgeContextResolver.js'

export const JUDGE_UPDATED_EVENT = 'bianleme:judge-updated'

const JUDGE_CONVERSATION_STATUS = {
  idle: 'idle',
  completed: 'completed',
}

export function listJudgeConversations() {
  const activeUserId = getActiveUserId()
  const accessState = getUserDataAccessState()
  if (!activeUserId) return []

  if (accessState.mode === 'local') {
    return normalizeJudgeConversationCollection(getCachedLocalLibraryDb()?.judgeConversations, activeUserId)
  }

  if (accessState.mode !== 'developer') return []

  return normalizeJudgeConversationCollection(readLocalDb()?.judgeConversations, activeUserId)
}

export function getJudgeConversationById(conversationId) {
  return listJudgeConversations().find((conversation) => conversation.id === conversationId) ?? null
}

export function findOrCreateJudgeConversation(contextDraft = {}) {
  const activeUserId = getActiveUserId()
  if (!activeUserId || !canWriteUserData()) {
    notifyUserDataBlocked()
    return {
      conversation: null,
      context: resolveJudgeContext(contextDraft),
    }
  }

  const context = resolveJudgeContext(contextDraft)
  const draft = createConversationDraftFromContext(context)
  const key = getJudgeContextKey(draft)
  const existing = listJudgeConversations().find((conversation) => getJudgeContextKey(conversation) === key)

  if (existing) {
    return {
      conversation: existing,
      context,
    }
  }

  const conversation = createJudgeConversationModel({
    ...draft,
    userId: activeUserId,
  })

  saveJudgeConversation(conversation)

  return {
    conversation,
    context,
  }
}

export function createJudgeConversationFromFile(fileDraft = {}) {
  const activeUserId = getActiveUserId()
  if (!activeUserId || !canWriteUserData()) {
    notifyUserDataBlocked()
    return null
  }

  const title = fileDraft.name ? `Judge · ${fileDraft.name}` : 'Judge · 导入材料'
  const conversation = createJudgeConversationModel({
    title,
    contextType: JUDGE_CONTEXT_TYPES.match,
    sourceLabel: fileDraft.name || '导入材料',
    userId: activeUserId,
  })

  return saveJudgeConversation(conversation)
}

export function saveJudgeConversation(conversationDraft) {
  const activeUserId = getActiveUserId()
  if (!activeUserId || !canWriteUserData()) {
    notifyUserDataBlocked()
    return null
  }

  const conversation = createJudgeConversationModel({
    ...conversationDraft,
    userId: activeUserId,
    updatedAt: new Date().toISOString(),
  })
  const conversations = [
    conversation,
    ...listJudgeConversations().filter((item) => item.id !== conversation.id),
  ]

  writeJudgeConversations(conversations)
  return conversation
}

export function deleteJudgeConversation(conversationId) {
  if (!conversationId) return listJudgeConversations()

  if (!canWriteUserData()) {
    notifyUserDataBlocked()
    return listJudgeConversations()
  }

  writeJudgeConversations(listJudgeConversations().filter((conversation) => conversation.id !== conversationId))
  return listJudgeConversations()
}

export async function appendJudgeRun(conversationId, prompt, options = {}) {
  const conversation = getJudgeConversationById(conversationId)
  if (!conversation) return null

  const result = await runJudgeAgent({
    conversation,
    lengthMode: options.lengthMode,
    modelProfile: options.modelProfile,
    provider: options.provider,
    sourceText: options.sourceText,
    userPrompt: prompt,
  })
  const now = new Date().toISOString()
  const output = {
    id: createId('judge-output'),
    title: result.context?.sourceLabel || 'Judge 反馈',
    summary: getJudgeReportSummary(result.reportJson),
    actions: ['保存到当前页面', '加入 Judge 汇总'],
    sourceRefs: result.context.availableMaterials.map((material) => material.label),
    sourceTextExcerpt: createSourceTextExcerpt(options.sourceText),
    reportJson: result.reportJson,
    markdown: result.markdown,
    modelProfile: result.modelProfile,
    provider: result.provider,
    createdAt: now,
  }
  const run = {
    id: createId('judge-run'),
    modelProfile: result.modelProfile,
    prompt,
    provider: result.provider,
    status: 'completed',
    warnings: result.warnings,
    createdAt: now,
    updatedAt: now,
  }
  const updated = saveJudgeConversation({
    ...conversation,
    status: JUDGE_CONVERSATION_STATUS.completed,
    messages: [
      ...conversation.messages,
      createJudgeMessage({ role: 'user', content: prompt }),
      createJudgeMessage({ role: 'assistant', content: output.summary }),
    ],
    runs: [...conversation.runs, run],
    outputs: [...conversation.outputs, output],
  })

  return {
    conversation: updated,
    context: result.context,
    output,
    run,
  }
}

export async function appendJudgeQuestion(conversationId, prompt, options = {}) {
  const conversation = getJudgeConversationById(conversationId)
  if (!conversation) return null

  const result = await runJudgeChatAnswer({
    conversation,
    modelProfile: options.modelProfile,
    provider: options.provider,
    sourceText: options.sourceText || conversation.outputs?.at(-1)?.sourceTextExcerpt || '',
    userPrompt: prompt,
  })
  const now = new Date().toISOString()
  const run = {
    id: createId('judge-chat'),
    modelProfile: result.modelProfile,
    prompt,
    provider: result.provider,
    status: 'completed',
    warnings: [],
    createdAt: now,
    updatedAt: now,
  }
  const updated = saveJudgeConversation({
    ...conversation,
    messages: [
      ...conversation.messages,
      createJudgeMessage({ role: 'user', content: prompt, kind: 'question' }),
      createJudgeMessage({ role: 'assistant', content: result.answer, kind: 'answer' }),
    ],
    runs: [...conversation.runs, run],
  })

  return {
    answer: result.answer,
    conversation: updated,
    run,
  }
}

export function appendMockJudgeRun(conversationId, prompt) {
  return appendJudgeRun(conversationId, prompt, { provider: 'mock' })
}

function createJudgeConversationModel(conversation = {}) {
  const now = new Date().toISOString()

  return {
    id: conversation.id ?? createId('judge'),
    userId: conversation.userId ?? DEMO_USER_ID,
    title: conversation.title ?? '新的 Judge 会话',
    contextType: normalizeContextType(conversation.contextType),
    matchId: conversation.matchId ?? '',
    reviewId: conversation.reviewId ?? '',
    trainingId: conversation.trainingId ?? '',
    sourceLabel: conversation.sourceLabel ?? '',
    status: conversation.status === JUDGE_CONVERSATION_STATUS.completed
      ? JUDGE_CONVERSATION_STATUS.completed
      : JUDGE_CONVERSATION_STATUS.idle,
    messages: Array.isArray(conversation.messages) ? conversation.messages : [],
    runs: Array.isArray(conversation.runs) ? conversation.runs : [],
    outputs: Array.isArray(conversation.outputs) ? conversation.outputs : [],
    createdAt: conversation.createdAt ?? now,
    updatedAt: conversation.updatedAt ?? now,
  }
}

function createJudgeMessage({ role, content, kind = 'message' }) {
  return {
    id: createId('judge-message'),
    role,
    content,
    kind,
    createdAt: new Date().toISOString(),
  }
}

function getJudgeContextKey(conversation) {
  return [
    conversation.contextType,
    conversation.matchId || '-',
    conversation.reviewId || '-',
    conversation.trainingId || '-',
  ].join(':')
}

function normalizeContextType(type) {
  return Object.values(JUDGE_CONTEXT_TYPES).includes(type) ? type : JUDGE_CONTEXT_TYPES.match
}

function writeJudgeConversations(conversations) {
  const activeUserId = getActiveUserId()
  const accessState = getUserDataAccessState()
  if (!activeUserId || !canWriteUserData()) {
    notifyUserDataBlocked()
    return
  }

  const normalizedConversations = conversations.map((conversation) => createJudgeConversationModel({
    ...conversation,
    userId: activeUserId,
  }))

  if (accessState.mode === 'local') {
    void updateActiveLocalLibraryDb((libraryDb) => ({
      ...libraryDb,
      judgeConversations: [
        ...(Array.isArray(libraryDb.judgeConversations) ? libraryDb.judgeConversations : [])
          .filter((conversation) => createJudgeConversationModel(conversation).userId !== activeUserId),
        ...normalizedConversations,
      ],
    })).catch(reportLocalLibraryWriteError)
    notifyJudgeUpdated()
    return
  }

  if (accessState.mode !== 'developer') return

  const snapshot = readLocalDb() ?? {}
  const persistedConversations = Array.isArray(snapshot.judgeConversations) ? snapshot.judgeConversations : []
  writeLocalDb({
    ...snapshot,
    judgeConversations: [
      ...persistedConversations.filter((conversation) => createJudgeConversationModel(conversation).userId !== activeUserId),
      ...normalizedConversations,
    ],
  })
  notifyJudgeUpdated()
}

function normalizeJudgeConversationCollection(conversations, activeUserId) {
  return (Array.isArray(conversations) ? conversations : [])
    .map((conversation) => createJudgeConversationModel(conversation))
    .filter((conversation) => conversation.userId === activeUserId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

function reportLocalLibraryWriteError(error) {
  console.warn('无法写入本地资料包 Judge 记录', error)
}

function notifyJudgeUpdated() {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new Event(JUDGE_UPDATED_EVENT))
}

function getJudgeReportSummary(reportJson) {
  if (reportJson?.winner === 'undecidable') {
    return reportJson?.final_reasons?.[0] ?? '当前材料不足，暂无法给出完整胜负判断。'
  }

  return reportJson?.core_standard || 'JudgeAgent 已完成结构化评判。'
}

function createSourceTextExcerpt(sourceText = '') {
  const normalized = String(sourceText || '').trim()
  if (!normalized) return ''

  return normalized.slice(0, 60000)
}
