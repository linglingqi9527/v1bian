import { resolveJudgeContext } from '../judgeContextResolver.js'
import { buildJudgeChatPrompt, buildJudgePrompt } from './judgePromptBuilder.js'
import { normalizeJudgeReport, renderJudgeReportMarkdown } from './judgeReportSchema.js'

const JUDGE_PROVIDERS = {
  mock: runMockProvider,
  ollama: runOllamaProvider,
  'api-proxy': runApiProxyProvider,
}

export async function runJudgeAgent({
  conversation,
  userPrompt,
  sourceText = '',
  lengthMode = 'standard',
  modelProfile = 'default',
  provider = getConfiguredJudgeProvider(),
} = {}) {
  const resolvedContext = resolveJudgeContext({
    type: conversation?.contextType,
    matchId: conversation?.matchId,
    reviewId: conversation?.reviewId,
    trainingId: conversation?.trainingId,
  })
  const context = conversation?.sourceLabel && !conversation?.matchId && !conversation?.reviewId && !conversation?.trainingId
    ? {
        ...resolvedContext,
        sourceLabel: conversation.sourceLabel,
        title: conversation.title,
        availableMaterials: [{ id: 'file', label: conversation.sourceLabel, state: '已导入' }],
      }
    : resolvedContext
  const prompt = buildJudgePrompt({
    context,
    conversation,
    lengthMode,
    userPrompt,
    sourceText,
  })
  const activeProvider = JUDGE_PROVIDERS[provider] ? provider : 'mock'
  const runProvider = JUDGE_PROVIDERS[activeProvider]
  const rawReport = await runProvider({
    context,
    conversation,
    lengthMode,
    modelProfile,
    prompt,
    sourceText,
    userPrompt,
  })
  const reportJson = normalizeJudgeReport(rawReport, { lengthMode })
  const markdown = renderJudgeReportMarkdown(reportJson)

  return {
    context,
    markdown,
    modelProfile,
    provider: activeProvider,
    reportJson: {
      ...reportJson,
      markdown,
    },
    warnings: reportJson.uncertainties,
  }
}

export async function runJudgeChatAnswer({
  conversation,
  userPrompt,
  sourceText = '',
  modelProfile = 'default',
  provider = getConfiguredJudgeProvider(),
} = {}) {
  const prompt = buildJudgeChatPrompt({
    conversation,
    sourceText,
    userPrompt,
  })
  const activeProvider = JUDGE_PROVIDERS[provider] ? provider : 'mock'
  const answer = await runChatProvider(activeProvider, {
    conversation,
    modelProfile,
    prompt,
    sourceText,
    userPrompt,
  })

  return {
    answer,
    modelProfile,
    provider: activeProvider,
  }
}

function getConfiguredJudgeProvider() {
  return String(import.meta.env.VITE_JUDGE_LLM_PROVIDER ?? 'mock').trim() || 'mock'
}

async function runMockProvider({ context, lengthMode, userPrompt }) {
  const sourceLabel = context?.sourceLabel || 'AIB'

  return {
    source_boundary: `以下判读只依据当前导入材料与页面上下文；若角色标注存在混乱，将按场上功能处理。用户本次请求为：${userPrompt || '生成评判报告'}。`,
    length_mode: lengthMode,
    fact_sheet: {
      topic: context?.match?.topic ?? '未在材料中确认',
      match: sourceLabel,
      affirmative: context?.match?.affirmative ?? '',
      negative: context?.match?.negative ?? '',
      uncertainties: ['当前仍为 mock provider，真实胜负判断需要接入模型后生成。'],
    },
    core_standard: '本场评判应先确认双方各自承担的证明责任，再比较关键交锋中哪一方保住了更稳定的判断标准。',
    final_judgment: '当前仍是接口占位结果，只能判断材料处理链路是否跑通，不能据此评价真实胜负。接入真实模型后，这里会说明胜方赢在哪里、胜负幅度为何成立，以及哪些关键交锋决定了裁判心证。',
    winner: 'undecidable',
    win_margin: 'undecidable',
    main_clashes: [
      {
        title: '核心判准是否稳定',
        analysis: '当前只是接口占位，不能作为真实裁判分析。真实模型接入后，这一段会用连续论证说明双方如何争夺核心判准、谁完成了证明责任、哪一个回应改变了攻防压力，以及仍有哪些局部材料不足需要谨慎处理。',
        affirmative_claim: '等待真实模型从材料中抽取。',
        negative_attack: '等待真实模型从材料中抽取。',
        affirmative_response: '等待真实模型从材料中抽取。',
        judge_decision: '当前只是接口占位，不能给强判断。',
        remaining_issue: '需要接入真实 provider 后基于证据生成。',
      },
    ],
    final_reasons: ['**材料不足**：当前结果来自 mock provider，只用于验证前端流程和接口结构。'],
    speaker_feedback: [],
    best_debater: {
      speaker: '无法确认',
      side: '无法确认',
      reason: '当前为 mock provider，占位结果没有真实攻防材料支撑，不能评选最佳辩手。',
      key_contribution: '',
      evidence_refs: [],
      confidence: '[低置信]',
    },
    missing_materials: ['后续应接入带发言者标注的完整逐字稿。'],
    uncertainties: ['**当前为 mock 结果**，不能视作真实裁决。'],
  }
}

async function runOllamaProvider({ prompt }) {
  const endpoint = String(import.meta.env.VITE_JUDGE_OLLAMA_ENDPOINT ?? 'http://localhost:11434/v1/chat/completions')
  const model = String(import.meta.env.VITE_JUDGE_OLLAMA_MODEL ?? 'qwen3:4b')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama provider failed: ${response.status}`)
  }

  const data = await response.json()
  return parseProviderJson(data?.choices?.[0]?.message?.content)
}

async function runApiProxyProvider({ modelProfile, prompt }) {
  const endpoint = String(import.meta.env.VITE_JUDGE_AGENT_ENDPOINT ?? '/api/judge-agent').trim()
  if (!endpoint) {
    throw new Error('VITE_JUDGE_AGENT_ENDPOINT is required for api-proxy provider')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modelProfile, prompt }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Judge api-proxy provider failed: ${response.status}`)
  }

  return await response.json()
}

async function runChatProvider(provider, options) {
  if (provider === 'mock') {
    return `我收到你的追问了：${options.userPrompt || '继续解释'}。当前是 mock provider，占位回答只用于验证追问链路。`
  }

  if (provider === 'ollama') {
    return await runOllamaChatProvider(options)
  }

  return await runApiProxyChatProvider(options)
}

async function runOllamaChatProvider({ prompt }) {
  const endpoint = String(import.meta.env.VITE_JUDGE_OLLAMA_ENDPOINT ?? 'http://localhost:11434/v1/chat/completions')
  const model = String(import.meta.env.VITE_JUDGE_OLLAMA_MODEL ?? 'qwen3:4b')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.25,
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama chat provider failed: ${response.status}`)
  }

  const data = await response.json()
  return typeof data?.choices?.[0]?.message?.content === 'string'
    ? data.choices[0].message.content.trim()
    : '模型没有返回有效回答。'
}

async function runApiProxyChatProvider({ modelProfile, prompt }) {
  const endpoint = String(import.meta.env.VITE_JUDGE_AGENT_ENDPOINT ?? '/api/judge-agent').trim()
  if (!endpoint) {
    throw new Error('VITE_JUDGE_AGENT_ENDPOINT is required for api-proxy provider')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ modelProfile, prompt, responseMode: 'text' }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Judge api-proxy chat provider failed: ${response.status}`)
  }

  const data = await response.json()
  return typeof data.content === 'string' ? data.content.trim() : '模型没有返回有效回答。'
}

function parseProviderJson(content) {
  if (typeof content !== 'string') return {}

  const trimmed = content.trim()
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const jsonText = fencedMatch?.[1] ?? trimmed

  try {
    return JSON.parse(jsonText)
  } catch {
    return {
      source_boundary: '模型返回内容无法解析为 JSON。',
      uncertainties: ['**模型输出格式错误**：需要重试或切换 provider。'],
      markdown: trimmed,
    }
  }
}
