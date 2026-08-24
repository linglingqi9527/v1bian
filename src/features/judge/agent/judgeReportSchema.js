export const JUDGE_LENGTH_MODES = {
  brief: 'brief',
  standard: 'standard',
  full: 'full',
}

export const JUDGE_WINNERS = {
  affirmative: 'affirmative',
  negative: 'negative',
  undecidable: 'undecidable',
}

export const JUDGE_WIN_MARGINS = {
  big: 'big',
  medium: 'medium',
  small: 'small',
  undecidable: 'undecidable',
}

export const JUDGE_WORD_BUDGETS = {
  [JUDGE_LENGTH_MODES.brief]: {
    target: 2800,
    min: 2400,
    max: 2800,
  },
  [JUDGE_LENGTH_MODES.standard]: {
    target: 6500,
    min: 5600,
    max: 6500,
  },
  [JUDGE_LENGTH_MODES.full]: {
    target: 9000,
    min: 7800,
    max: 9000,
  },
}

export function getJudgeWordBudget(lengthMode = JUDGE_LENGTH_MODES.standard) {
  return JUDGE_WORD_BUDGETS[lengthMode] ?? JUDGE_WORD_BUDGETS[JUDGE_LENGTH_MODES.standard]
}

export function normalizeJudgeReport(reportDraft = {}, options = {}) {
  const lengthMode = normalizeLengthMode(reportDraft.length_mode ?? options.lengthMode)
  const wordBudget = {
    ...getJudgeWordBudget(lengthMode),
    ...(isObject(reportDraft.word_budget) ? reportDraft.word_budget : {}),
  }
  const normalizedWinner = normalizeWinner(reportDraft.winner)
  const normalizedWinMargin = normalizeWinMargin(reportDraft.win_margin)
  const inferredWinner = inferWinnerFromText(reportDraft)
  const inferredWinMargin = inferWinMarginFromText(reportDraft)

  return {
    source_boundary: normalizeText(reportDraft.source_boundary),
    length_mode: lengthMode,
    word_budget: wordBudget,
    role_mapping: normalizeList(reportDraft.role_mapping),
    fact_sheet: normalizeFactSheet(reportDraft.fact_sheet),
    core_standard: normalizeText(reportDraft.core_standard),
    final_judgment: normalizeText(reportDraft.final_judgment),
    winner: normalizedWinner === JUDGE_WINNERS.undecidable && inferredWinner
      ? inferredWinner
      : normalizedWinner,
    win_margin: normalizedWinMargin === JUDGE_WIN_MARGINS.undecidable && inferredWinMargin
      ? inferredWinMargin
      : normalizedWinMargin,
    main_clashes: normalizeList(reportDraft.main_clashes),
    final_reasons: normalizeList(reportDraft.final_reasons),
    speaker_feedback: normalizeList(reportDraft.speaker_feedback),
    best_debater: normalizeBestDebater(reportDraft.best_debater),
    missing_materials: normalizeList(reportDraft.missing_materials),
    uncertainties: normalizeList(reportDraft.uncertainties),
    markdown: normalizeText(reportDraft.markdown),
  }
}

export function renderJudgeReportMarkdown(reportDraft) {
  const report = normalizeJudgeReport(reportDraft)

  return [
    '# Judge 评判报告',
    '',
    report.source_boundary,
    '',
    '## 一、本场核心判准',
    report.core_standard || '材料不足，暂无法确认本场核心判准。',
    '',
    '## 二、终局判断',
    renderFinalDecision(report),
    report.final_judgment,
    '',
    '## 三、主要论述与攻防整理',
    renderClashes(report.main_clashes),
    '',
    '## 四、终局判决理由',
    renderList(report.final_reasons, '暂无完整终局理由。'),
    '',
    '## 五、本场最佳辩手',
    renderBestDebater(report.best_debater),
  ].filter(Boolean).join('\n')
}

export function createJudgeReportSchemaSummary() {
  return {
    required: [
      'source_boundary',
      'length_mode',
      'word_budget',
      'fact_sheet',
      'core_standard',
      'final_judgment',
      'winner',
      'win_margin',
      'main_clashes',
      'final_reasons',
      'best_debater',
      'markdown',
    ],
    enums: {
      length_mode: Object.values(JUDGE_LENGTH_MODES),
      winner: Object.values(JUDGE_WINNERS),
      win_margin: Object.values(JUDGE_WIN_MARGINS),
    },
  }
}

function normalizeFactSheet(factSheet = {}) {
  return {
    topic: normalizeText(factSheet.topic),
    match: normalizeText(factSheet.match),
    affirmative: normalizeText(factSheet.affirmative),
    negative: normalizeText(factSheet.negative),
    speaker_map: normalizeList(factSheet.speaker_map),
    speech_order: normalizeList(factSheet.speech_order),
    main_arguments: normalizeList(factSheet.main_arguments),
    key_clashes: normalizeList(factSheet.key_clashes),
    uncertainties: normalizeList(factSheet.uncertainties),
  }
}

function normalizeBestDebater(bestDebater = {}) {
  if (!isObject(bestDebater)) {
    return {
      speaker: '',
      side: '',
      reason: '',
      key_contribution: '',
      evidence_refs: [],
      confidence: '',
    }
  }

  return {
    speaker: normalizeText(bestDebater.speaker),
    side: normalizeText(bestDebater.side),
    reason: normalizeText(bestDebater.reason),
    key_contribution: normalizeText(bestDebater.key_contribution),
    evidence_refs: normalizeList(bestDebater.evidence_refs),
    confidence: normalizeText(bestDebater.confidence),
  }
}

function renderFinalDecision(report) {
  const winnerLabel = {
    [JUDGE_WINNERS.affirmative]: '正方',
    [JUDGE_WINNERS.negative]: '反方',
    [JUDGE_WINNERS.undecidable]: '无法判断',
  }[report.winner]
  const marginLabel = {
    [JUDGE_WIN_MARGINS.big]: '大胜',
    [JUDGE_WIN_MARGINS.medium]: '中胜',
    [JUDGE_WIN_MARGINS.small]: '小胜',
    [JUDGE_WIN_MARGINS.undecidable]: '无法判断',
  }[report.win_margin]

  if (report.winner === JUDGE_WINNERS.undecidable) {
    return '**材料不足，暂无法给出完整胜负判断**。'
  }

  return `我最终判 **${winnerLabel}获胜**，胜负幅度为 **${marginLabel}**。`
}

function renderClashes(clashes) {
  if (!clashes.length) return '暂无可确认的主要论述与攻防。'

  return clashes.map((clash, index) => {
    if (typeof clash === 'string') return `### 论述${index + 1}：主要交锋\n${normalizeText(clash)}`

    return [
      `### 论述${index + 1}：${normalizeText(clash.title) || '主要交锋'}`,
      normalizeText(clash.analysis) ? normalizeText(clash.analysis) : '',
      normalizeText(clash.analysis) ? '' : [
        normalizeText(clash.affirmative_claim) ? `正方主张：${normalizeText(clash.affirmative_claim)}` : '',
        normalizeText(clash.negative_attack) ? `反方攻击：${normalizeText(clash.negative_attack)}` : '',
        normalizeText(clash.affirmative_response) ? `正方回应：${normalizeText(clash.affirmative_response)}` : '',
        normalizeText(clash.judge_decision) ? `裁判判断：**${normalizeText(clash.judge_decision)}**` : '',
        normalizeText(clash.remaining_issue) ? `残留问题：${normalizeText(clash.remaining_issue)}` : '',
      ].filter(Boolean).join('\n\n'),
    ].filter(Boolean).join('\n\n')
  }).join('\n\n')
}

function renderList(items, fallback) {
  if (!items.length) return fallback

  return items.map((item) => {
    if (typeof item === 'string') return `- ${normalizeText(item)}`
    if (item.speaker) {
      return `- **${normalizeText(item.speaker)}**：${renderSpeakerReview(item)}`
    }
    if (item.speaker || item.title) {
      return `- **${item.speaker ?? item.title}**：${item.advice ?? item.summary ?? item.content ?? ''}`
    }
    return `- ${JSON.stringify(item)}`
  }).join('\n')
}

function renderSpeakerReview(item) {
  if (normalizeText(item.review)) return normalizeText(item.review)

  const opening = normalizeText(item.contribution)
    ? `这场把${normalizeText(item.contribution)}推到了台面上`
    : '这场可确认的材料还不够完整'
  const effect = normalizeText(item.effect) ? `，直接效果是${normalizeText(item.effect)}` : ''
  const alignment = normalizeText(item.standard_alignment) ? `。放回本场判准看，${normalizeText(item.standard_alignment)}` : ''
  const problem = normalizeText(item.problem) ? `不过比较可惜的是，${normalizeText(item.problem)}` : ''
  const advice = normalizeText(item.advice) ? `下一场可以优先处理：**${normalizeText(item.advice)}**。` : ''
  const confidence = normalizeText(item.confidence) ? `（${normalizeText(item.confidence)}）` : ''

  return normalizeText(`${opening}${effect}${alignment}。${problem}${advice}${confidence}`)
}

function renderBestDebater(bestDebater) {
  if (!bestDebater?.speaker) return '材料不足，暂无法确认本场最佳辩手。'

  return [
    `**${bestDebater.speaker}**${bestDebater.side ? `（${bestDebater.side}）` : ''}`,
    bestDebater.key_contribution ? `核心贡献：${bestDebater.key_contribution}` : '',
    bestDebater.reason ? `评选理由：${bestDebater.reason}` : '',
    bestDebater.confidence ? `置信度：${bestDebater.confidence}` : '',
  ].filter(Boolean).join('\n\n')
}

function normalizeLengthMode(lengthMode) {
  return Object.values(JUDGE_LENGTH_MODES).includes(lengthMode)
    ? lengthMode
    : JUDGE_LENGTH_MODES.standard
}

function normalizeWinner(winner) {
  return Object.values(JUDGE_WINNERS).includes(winner) ? winner : JUDGE_WINNERS.undecidable
}

function normalizeWinMargin(winMargin) {
  return Object.values(JUDGE_WIN_MARGINS).includes(winMargin) ? winMargin : JUDGE_WIN_MARGINS.undecidable
}

function normalizeList(value) {
  return Array.isArray(value) ? value.map(normalizeReportValue) : []
}

function normalizeText(value) {
  return typeof value === 'string' ? stripVisibleTimestamps(value).trim() : ''
}

function normalizeReportValue(value) {
  if (typeof value === 'string') return normalizeText(value)
  if (Array.isArray(value)) return value.map(normalizeReportValue)
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, normalizeReportValue(nestedValue)]),
    )
  }
  return value
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function inferWinnerFromText(reportDraft) {
  const text = collectReportText(reportDraft)
  if (/((判|认为|最终|结论)[^。；，,]{0,16})?正方(获胜|胜|赢)|正方胜/.test(text)) {
    return JUDGE_WINNERS.affirmative
  }
  if (/((判|认为|最终|结论)[^。；，,]{0,16})?反方(获胜|胜|赢)|反方胜/.test(text)) {
    return JUDGE_WINNERS.negative
  }
  return ''
}

function inferWinMarginFromText(reportDraft) {
  const text = collectReportText(reportDraft)
  if (/大胜|明显胜|较大优势/.test(text)) return JUDGE_WIN_MARGINS.big
  if (/中胜|中等|中幅|中等幅度/.test(text)) return JUDGE_WIN_MARGINS.medium
  if (/小胜|微弱|略胜|小幅/.test(text)) return JUDGE_WIN_MARGINS.small
  return ''
}

function collectReportText(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(collectReportText).join('\n')
  if (isObject(value)) return Object.values(value).map(collectReportText).join('\n')
  return ''
}

function stripVisibleTimestamps(text) {
  return text
    .replace(/[（(]?\s*(?:如|例如)?\d{1,2}[:：]\d{2}(?:[:：]\d{2})?(?:\s*\/\s*\d{1,2}[:：]\d{2}(?:[:：]\d{2})?)*\s*[）)]?/g, '')
    .replace(/\s{2,}/g, ' ')
}
