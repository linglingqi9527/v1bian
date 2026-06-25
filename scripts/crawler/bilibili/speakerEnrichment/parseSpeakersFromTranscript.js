const ROLE_PATTERN = '(一辩|二辩|三辩|四辩|1辩|2辩|3辩|4辩)'
const NAME_PATTERN = '([\u4e00-\u9fff·]{2,5})'
const STOP_NAMES = new Set([
  '正方辩手', '反方辩手', '双方辩手', '一辩', '二辩', '三辩', '四辩',
  '主持人', '主席', '评委', '老师', '同学', '代表队', '辩论队',
])

export function parseSpeakersFromTranscript(transcriptText = '') {
  const text = normalizeTranscript(transcriptText)
  if (!text) return { candidates: [], warnings: ['转写文本为空，无法识别辩手。'] }

  const openingText = openingSection(text)

  const explicitCandidates = extractExplicitRoleCandidates(openingText)
  const contextualCandidates = extractContextualRoleCandidates(openingText)
  const sideListCandidates = extractSideListCandidates(openingText)
  const invitationCandidates = extractInvitationCandidates(openingText)
  const roleCandidates = contextualCandidates.length >= 4
    ? contextualCandidates
    : [...explicitCandidates, ...contextualCandidates]
  const candidates = dedupeCandidates([
    ...roleCandidates,
    ...sideListCandidates,
    ...invitationCandidates,
  ])
  const explicitRoleCount = new Set(
    candidates.filter((candidate) => candidate.side && candidate.role)
      .map((candidate) => `${candidate.side}-${candidate.role}`),
  ).size

  for (const candidate of candidates) {
    applyConfidence(candidate, explicitRoleCount)
  }

  const warnings = []
  if (candidates.length === 0) warnings.push('没有从开场转写中识别出辩手候选。')
  if (candidates.length > 0 && explicitRoleCount < 6) warnings.push('明确辩位少于 6 个，名单需要人工复核。')
  if (!candidates.some((candidate) => candidate.side === '正方')) warnings.push('未识别到正方候选。')
  if (!candidates.some((candidate) => candidate.side === '反方')) warnings.push('未识别到反方候选。')

  return { candidates, warnings }
}

function extractContextualRoleCandidates(text) {
  const candidates = []
  const sidePattern = /(正方|反方)/g

  for (const sideMatch of text.matchAll(sidePattern)) {
    const side = sideMatch[1]
    const segmentStart = sideMatch.index
    const tail = text.slice(segmentStart, segmentStart + 180)
    const firstRole = tail.search(/[一二三四1234]辩/)
    if (firstRole < 0 || firstRole > 36) continue

    const oppositeSide = side === '正方' ? '反方' : '正方'
    const oppositeIndex = tail.indexOf(oppositeSide, firstRole + 2)
    const segment = oppositeIndex > 0 ? tail.slice(0, oppositeIndex) : tail
    const roles = [...segment.matchAll(new RegExp(ROLE_PATTERN, 'g'))]
    if (roles.length < 2) continue

    roles.forEach((roleMatch, index) => {
      const nameStart = roleMatch.index + roleMatch[0].length
      const nameEnd = roles[index + 1]?.index ?? segment.length
      const rawName = segment.slice(nameStart, nameEnd)
      const name = cleanContextualName(rawName)
      if (!name) return

      candidates.push(createCandidate({
        name,
        side,
        role: normalizeRole(roleMatch[1]),
        rawText: `${roleMatch[0]}${rawName}`.trim(),
        transcriptSnippet: snippetAround(text, segmentStart + roleMatch.index, rawName.length),
        evidence: 'context-role',
      }))
    })
  }

  return candidates
}

function extractExplicitRoleCandidates(text) {
  const candidates = []
  const pattern = new RegExp(
    `(正方|反方)(?:的|本场)?\\s*${ROLE_PATTERN}(?:是|由|为|叫|选手是|辩手是|由选手)?\\s*${NAME_PATTERN}`,
    'g',
  )
  for (const match of text.matchAll(pattern)) {
    const name = cleanName(match[3])
    if (!name) continue
    candidates.push(createCandidate({
      name,
      side: match[1],
      role: normalizeRole(match[2]),
      rawText: match[0],
      transcriptSnippet: snippetAround(text, match.index, match[0].length),
      evidence: 'explicit-role',
    }))
  }
  return candidates
}

function extractSideListCandidates(text) {
  const candidates = []
  const pattern = /(正方|反方)(?:辩手|队员|阵容|的辩手)(?:分别是|分别为|是|为|有)?[：:]?\s*([^。！？\n]{2,80})/g
  for (const match of text.matchAll(pattern)) {
    const names = extractNames(match[2]).slice(0, 4)
    names.forEach((name, index) => {
      candidates.push(createCandidate({
        name,
        side: match[1],
        role: '',
        rawText: match[0],
        transcriptSnippet: snippetAround(text, match.index, match[0].length),
        evidence: 'side-list',
        orderHint: index + 1,
      }))
    })
  }
  return candidates
}

function extractInvitationCandidates(text) {
  const candidates = []
  const pattern = /(?:有请|介绍|欢迎|本场)(正方|反方)(?:辩手|选手)?\s*([\u4e00-\u9fff·]{2,5})/g
  for (const match of text.matchAll(pattern)) {
    const name = cleanName(match[2])
    if (!name) continue
    candidates.push(createCandidate({
      name,
      side: match[1],
      role: '',
      rawText: match[0],
      transcriptSnippet: snippetAround(text, match.index, match[0].length),
      evidence: 'invitation',
    }))
  }
  return candidates
}

function createCandidate(details) {
  return {
    name: details.name,
    side: details.side,
    role: details.role,
    source: 'openingAudioTranscript',
    confidence: 0,
    confidenceLevel: 'low',
    rawText: details.rawText,
    transcriptSnippet: details.transcriptSnippet,
    _evidence: details.evidence,
    _orderHint: details.orderHint ?? null,
  }
}

function applyConfidence(candidate, explicitRoleCount) {
  if (candidate._evidence === 'explicit-role' || candidate._evidence === 'context-role') {
    candidate.confidence = explicitRoleCount >= 6 ? 0.94 : 0.78
    candidate.confidenceLevel = explicitRoleCount >= 6 ? 'high' : 'medium'
  } else if (candidate._evidence === 'side-list') {
    candidate.confidence = 0.66
    candidate.confidenceLevel = 'medium'
  } else {
    candidate.confidence = 0.42
    candidate.confidenceLevel = 'low'
  }
  delete candidate._evidence
  delete candidate._orderHint
}

function cleanContextualName(value) {
  const firstChunk = String(value ?? '').trim().split(/\s+/)[0] ?? ''
  const compact = firstChunk.replace(/\s+/g, '')
  const beforeMarker = compact.split(
    /正方|反方|中国|中國|大学|大學|学院|學院|代表队|代表對|辩论队|辯論對|问候|溫候|在场|各位/,
  )[0]
  const token = beforeMarker.match(/[\u4e00-\u9fff·]{2,5}/)?.[0] ?? ''
  return cleanName(token)
}

function extractNames(value) {
  const names = []
  for (const match of value.matchAll(/[\u4e00-\u9fff·]{2,5}/g)) {
    const name = cleanName(match[0])
    if (name) names.push(name)
  }
  return [...new Set(names)]
}

function cleanName(value) {
  const name = String(value ?? '').replace(/^(?:的|为|是|由)+/, '').trim()
  if (!/^[\u4e00-\u9fff·]{2,5}$/.test(name)) return ''
  if (STOP_NAMES.has(name)) return ''
  if (/(大学|学院|学校|中学|书院|辩论队|代表队)$/.test(name)) return ''
  return name
}

function normalizeRole(role) {
  return String(role).replace('1', '一').replace('2', '二').replace('3', '三').replace('4', '四')
}

function normalizeTranscript(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\u00a0]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/([一二三四1234])[辯遍變变]/g, '$1辩')
    .replace(/[辯變变]手/g, '辩手')
    .replace(/比賽/g, '比赛')
    .replace(/正式開始/g, '正式开始')
    .replace(/有請/g, '有请')
    .replace(/雙方/g, '双方')
    .trim()
}

function openingSection(text) {
  const endMarkers = ['比赛正式开始', '首先进入比赛', '首先是陈词', '首先是申论']
  const endIndex = endMarkers
    .map((marker) => text.indexOf(marker))
    .filter((index) => index > 0)
    .sort((left, right) => left - right)[0]
  return endIndex ? text.slice(0, endIndex) : text.slice(0, 2400)
}

function snippetAround(text, index = 0, length = 0) {
  const start = Math.max(0, index - 40)
  const end = Math.min(text.length, index + length + 60)
  return text.slice(start, end)
}

function dedupeCandidates(candidates) {
  const unique = new Map()
  for (const candidate of candidates) {
    const key = `${candidate.side}|${candidate.role}|${candidate.name}`
    if (!unique.has(key)) unique.set(key, candidate)
  }
  return [...unique.values()]
}
