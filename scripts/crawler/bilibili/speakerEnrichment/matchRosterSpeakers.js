import { pinyin } from 'pinyin-pro'
import { extractIntroSnippetText } from './transcriptIntroSnippet.js'

const MIN_AUTO_MATCH_SCORE = 0.8
const MIN_CONTEXT_CANDIDATE_SCORE = 0.4
const MIN_SECOND_PASS_CANDIDATE_SCORE = 0.28
const STRONG_ROLE_CONTEXT_BONUS = 0.18
const TEAM_HINT_BONUS = 0.18
const TEAM_HINT_PENALTY = 0.24
const MIN_SCORE_MARGIN = 0.08
const MAX_SPEAKERS_PER_TEAM = 4
const MAX_ROLE_MARKERS = 16
const MAX_SEGMENT_CHARS = 56
const MAX_CONTEXT_WINDOW_START = 8
const SECOND_PASS_TOP_CANDIDATES_PER_SEGMENT = 8

export function matchRosterSpeakers({
  rosterContext,
  strategy = 'standard',
  transcriptText = '',
} = {}) {
  const isSecondPass = strategy === 'secondPass'
  const introText = extractIntroSnippetText(transcriptText)
  const segments = extractRoleFollowingSegments(introText)
  const members = flattenRosterMembers(rosterContext.teams)
  const assignments = isSecondPass
    ? selectSecondPassAssignments([
      ...segments.flatMap((segment) => secondPassRosterCandidates(segment, members)),
      ...teamBlockRosterCandidates({
        members,
        teamBlocks: extractTeamIntroBlocks(introText, rosterContext.teams.length),
      }),
    ])
    : selectGlobalAssignments(
      segments
        .map((segment) => bestRosterCandidate(segment, members))
        .filter(Boolean),
      rosterContext.teams.length,
    )
  const teams = rosterContext.teams.map((team, teamIndex) => ({
    team: team.rosterTeam,
    speakers: assignments
      .filter((assignment) => assignment.teamIndex === teamIndex)
      .map(toSpeakerResult),
  }))
  const speakerCount = teams.reduce((total, team) => total + team.speakers.length, 0)
  const autoMergeCount = teams.reduce((total, team) => (
    total + team.speakers.filter((speaker) => speaker.autoMerge).length
  ), 0)
  const warnings = []

  if (segments.length === 0) warnings.push('自我介绍区间内没有识别到“一辩/二辩/三辩/四辩”标记。')
  if (speakerCount === 0) warnings.push('转写成功，但没有与双方报名名单形成可靠匹配。')
  if (speakerCount > autoMergeCount) warnings.push('存在低置信辩位候选，仅写入候选报告，不会自动合并进卡片。')
  if (speakerCount > 0 && speakerCount < 8) {
    warnings.push(`仅匹配到 ${speakerCount} 名辩手，需要人工复核或提高转写模型。`)
  }
  for (const team of teams) {
    if (team.speakers.length !== MAX_SPEAKERS_PER_TEAM) {
      warnings.push(`${team.team}匹配到 ${team.speakers.length} 人，未达到 4 人。`)
    }
  }

  return {
    roleMarkerCount: segments.length,
    teams,
    warnings: [...new Set(warnings)],
  }
}

function extractRoleFollowingSegments(text) {
  const markers = [...text.matchAll(/一辩|二辩|三辩|四辩/g)].slice(0, MAX_ROLE_MARKERS)
  let currentTeamHint = 0
  let previousRoleNumber = 0
  return markers.map((marker, index) => {
    const roleNumber = roleToNumber(marker[0])
    if (index > 0 && roleNumber <= previousRoleNumber) currentTeamHint += 1
    previousRoleNumber = roleNumber
    const start = marker.index + marker[0].length
    const nextMarkerIndex = markers[index + 1]?.index ?? text.length
    const end = Math.min(nextMarkerIndex, start + MAX_SEGMENT_CHARS)
    const transcriptSnippet = text.slice(
      Math.max(0, marker.index - 12),
      Math.min(text.length, end + 12),
    )
    return {
      id: index,
      role: marker[0],
      text: text.slice(start, end),
      teamHintIndex: inferTeamHintIndex(transcriptSnippet, Math.min(currentTeamHint, 1)),
      transcriptSnippet,
    }
  })
}

function flattenRosterMembers(teams) {
  return teams.flatMap((team, teamIndex) => team.members.map((name, memberIndex) => ({
    id: `${teamIndex}:${memberIndex}`,
    name,
    teamIndex,
  })))
}

function bestRosterCandidate(segment, members) {
  const ranked = members
    .map((member) => ({
      ...member,
      ...compareSegmentToName(segment.text, member.name),
      segmentId: segment.id,
      role: segment.role,
      transcriptSnippet: segment.transcriptSnippet,
    }))
    .sort((left, right) => right.score - left.score)
  const best = ranked[0]
  const second = ranked[1]

  if (!best) return null
  const hasEnoughMargin = !second || best.score - second.score >= MIN_SCORE_MARGIN
  if (best.score >= MIN_AUTO_MATCH_SCORE && hasEnoughMargin) {
    return { ...best, autoMerge: true }
  }
  const contextCandidate = ranked.find((candidate) => (
    candidate.score >= MIN_CONTEXT_CANDIDATE_SCORE
    && candidate.windowStart <= MAX_CONTEXT_WINDOW_START
  ))
  if (
    contextCandidate
  ) {
    return {
      ...contextCandidate,
      autoMerge: false,
      method: `${contextCandidate.method}-role-context`,
    }
  }
  return null
}

function secondPassRosterCandidates(segment, members) {
  return members
    .map((member) => {
      const compared = compareSegmentToName(segment.text, member.name, {
        allowShortWindow: true,
      })
      const teamHintMatched = segment.teamHintIndex === member.teamIndex
      const roleBonus = roleContextBonus(compared.windowStart)
      const teamHintScore = teamHintMatched ? TEAM_HINT_BONUS : -TEAM_HINT_PENALTY
      const score = clampScore(compared.score + roleBonus + teamHintScore)
      return {
        ...member,
        ...compared,
        baseScore: compared.score,
        method: `${compared.method}-second-pass`,
        role: segment.role,
        score,
        segmentId: segment.id,
        teamHintIndex: segment.teamHintIndex,
        teamHintMatched,
        transcriptSnippet: segment.transcriptSnippet,
      }
    })
    .filter((candidate) => (
      candidate.baseScore > 0
      && candidate.score >= MIN_SECOND_PASS_CANDIDATE_SCORE
      && candidate.windowStart <= MAX_CONTEXT_WINDOW_START + 4
    ))
    .sort((left, right) => right.score - left.score)
    .slice(0, SECOND_PASS_TOP_CANDIDATES_PER_SEGMENT)
    .map((candidate) => ({
      ...candidate,
      autoMerge: candidate.score >= MIN_AUTO_MATCH_SCORE,
    }))
}

function teamBlockRosterCandidates({
  members,
  teamBlocks,
}) {
  return teamBlocks.flatMap((block) => {
    const blockMembers = members.filter((member) => member.teamIndex === block.teamIndex)
    return blockMembers
      .map((member) => {
        const compared = compareSegmentToName(block.text, member.name, {
          allowShortWindow: true,
          maxWindowStart: 120,
        })
        const score = clampScore(compared.score + 0.08)
        return {
          ...member,
          ...compared,
          baseScore: compared.score,
          method: `${compared.method}-team-block-second-pass`,
          role: '',
          score,
          segmentId: `block:${block.teamIndex}:${member.id}`,
          teamHintIndex: block.teamIndex,
          teamHintMatched: true,
          transcriptSnippet: snippetAround(block.text, compared.windowStart, compared.recognizedText.length),
          autoMerge: score >= MIN_AUTO_MATCH_SCORE,
        }
      })
      .filter((candidate) => (
        candidate.baseScore >= 0.58
        && candidate.windowStart <= 96
      ))
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_SPEAKERS_PER_TEAM + 2)
  })
}

function compareSegmentToName(segmentText, officialName, {
  allowShortWindow = false,
  maxWindowStart = 32,
} = {}) {
  const officialLength = normalizeText(officialName).length
  const windows = candidateWindows(segmentText, officialLength, {
    allowShortWindow,
    maxStart: maxWindowStart,
  })
  return windows
    .map((window) => ({
      recognizedText: window.text,
      windowStart: window.start,
      ...compareNames(window.text, officialName),
    }))
    .sort((left, right) => right.score - left.score)[0]
    ?? { method: 'none', recognizedText: '', score: 0, windowStart: Number.POSITIVE_INFINITY }
}

function candidateWindows(value, officialLength, {
  allowShortWindow = false,
  maxStart = 32,
} = {}) {
  const chinese = String(value ?? '').replace(/[^\u4e00-\u9fff·]/g, '')
  const lengths = [
    ...new Set(allowShortWindow
      ? [officialLength - 2, officialLength - 1, officialLength, officialLength + 1]
      : [officialLength, officialLength + 1]),
  ]
    .filter((length) => length > 1)
  const windows = []
  for (const length of lengths) {
    for (let index = 0; index <= Math.min(chinese.length - length, maxStart); index += 1) {
      windows.push({
        start: index,
        text: chinese.slice(index, index + length),
      })
    }
  }
  return windows
}

function extractTeamIntroBlocks(text, teamCount) {
  if (teamCount <= 1) return [{ teamIndex: 0, text }]
  const secondTeamMatch = /反方是|本方是|坐在.{0,12}左手边.{0,8}反方/.exec(text)
  const secondStart = secondTeamMatch?.index ?? -1
  if (secondStart <= 0) {
    return [
      { teamIndex: 0, text },
      { teamIndex: 1, text },
    ]
  }
  return [
    { teamIndex: 0, text: text.slice(0, secondStart) },
    { teamIndex: 1, text: text.slice(secondStart) },
  ]
}

function compareNames(left, right) {
  const normalizedLeft = normalizeText(left)
  const normalizedRight = normalizeText(right)
  if (!normalizedLeft || !normalizedRight) return { method: 'none', score: 0 }
  if (normalizedLeft === normalizedRight) return { method: 'exact', score: 1 }

  const leftPinyin = pinyin(normalizedLeft, { toneType: 'none', type: 'array' })
  const rightPinyin = pinyin(normalizedRight, { toneType: 'none', type: 'array' })
  const pinyinDistance = levenshteinDistance(leftPinyin, rightPinyin)
  const pinyinSimilarity = 1 - pinyinDistance / Math.max(leftPinyin.length, rightPinyin.length)
  const syllableSimilarity = averageSyllableSimilarity(leftPinyin, rightPinyin)
  const characterSimilarity = alignedCharacterSimilarity(normalizedLeft, normalizedRight)
  if (pinyinSimilarity === 1) return { method: 'pinyin', score: 0.96 }
  if (
    leftPinyin.length === rightPinyin.length
    && syllableSimilarity >= 0.8
  ) {
    return { method: 'pinyin-fuzzy', score: 0.88 }
  }
  if (pinyinSimilarity >= 2 / 3) return { method: 'pinyin-fuzzy', score: 0.82 }

  const softScore = Math.max(
    characterSimilarity * 0.72,
    syllableSimilarity * 0.62,
  )
  if (softScore >= MIN_CONTEXT_CANDIDATE_SCORE) {
    return { method: 'pinyin-soft', score: Math.min(0.72, softScore) }
  }

  return { method: 'none', score: 0 }
}

function averageSyllableSimilarity(left, right) {
  if (!left.length || !right.length) return 0
  const total = left.reduce((sum, syllable, index) => {
    const counterpart = right[index]
    if (!counterpart) return sum
    const distance = levenshteinDistance(syllable, counterpart)
    return sum + 1 - distance / Math.max(syllable.length, counterpart.length)
  }, 0)
  return total / Math.max(left.length, right.length)
}

function alignedCharacterSimilarity(left, right) {
  const length = Math.max(left.length, right.length)
  if (!length) return 0
  let matched = 0
  for (let index = 0; index < length; index += 1) {
    if (left[index] && left[index] === right[index]) matched += 1
  }
  return matched / length
}

function selectGlobalAssignments(candidates, teamCount) {
  const best = searchAssignments(candidates, 0, new Set(), Array(teamCount).fill(0))
  return best.assignments
}

function selectSecondPassAssignments(candidates) {
  const assignments = []
  const usedMembers = new Set()
  const usedSegments = new Set()
  const teamCounts = []
  const ranked = [...candidates].sort((left, right) => (
    right.score - left.score
    || Number(right.teamHintMatched) - Number(left.teamHintMatched)
  ))

  for (const candidate of ranked) {
    if (usedMembers.has(candidate.id)) continue
    if (usedSegments.has(candidate.segmentId)) continue
    if ((teamCounts[candidate.teamIndex] ?? 0) >= MAX_SPEAKERS_PER_TEAM) continue

    assignments.push(candidate)
    usedMembers.add(candidate.id)
    usedSegments.add(candidate.segmentId)
    teamCounts[candidate.teamIndex] = (teamCounts[candidate.teamIndex] ?? 0) + 1
  }

  return assignments
}

function searchAssignments(candidates, index, usedMembers, teamCounts) {
  if (index >= candidates.length) return { assignments: [], score: 0 }

  const skipped = searchAssignments(candidates, index + 1, usedMembers, teamCounts)
  const candidate = candidates[index]
  if (
    usedMembers.has(candidate.id)
    || teamCounts[candidate.teamIndex] >= MAX_SPEAKERS_PER_TEAM
  ) {
    return skipped
  }

  const nextUsedMembers = new Set(usedMembers)
  nextUsedMembers.add(candidate.id)
  const nextTeamCounts = [...teamCounts]
  nextTeamCounts[candidate.teamIndex] += 1
  const selectedRest = searchAssignments(
    candidates,
    index + 1,
    nextUsedMembers,
    nextTeamCounts,
  )
  const selected = {
    assignments: [candidate, ...selectedRest.assignments],
    score: candidate.score + selectedRest.score,
  }
  return betterAssignment(selected, skipped)
}

function betterAssignment(left, right) {
  if (left.assignments.length !== right.assignments.length) {
    return left.assignments.length > right.assignments.length ? left : right
  }
  return left.score >= right.score ? left : right
}

function toSpeakerResult(assignment) {
  return {
    name: assignment.name,
    role: assignment.role,
    recognizedText: assignment.recognizedText,
    confidence: Number(assignment.score.toFixed(2)),
    confidenceLevel: confidenceLevel(assignment.score),
    autoMerge: assignment.autoMerge,
    matchMethod: assignment.method,
    transcriptSnippet: assignment.transcriptSnippet,
  }
}

function confidenceLevel(score) {
  if (score >= 0.9) return 'high'
  if (score >= MIN_AUTO_MATCH_SCORE) return 'medium'
  return 'low'
}

function roleContextBonus(windowStart) {
  if (!Number.isFinite(windowStart)) return 0
  if (windowStart <= 2) return STRONG_ROLE_CONTEXT_BONUS
  if (windowStart <= MAX_CONTEXT_WINDOW_START) {
    return STRONG_ROLE_CONTEXT_BONUS * (1 - windowStart / (MAX_CONTEXT_WINDOW_START + 1))
  }
  return 0
}

function roleToNumber(role) {
  return {
    一辩: 1,
    二辩: 2,
    三辩: 3,
    四辩: 4,
  }[role] ?? 0
}

function inferTeamHintIndex(snippet, fallback) {
  const text = String(snippet ?? '')
  if (/反方|本方/.test(text)) return 1
  if (/正方|中方|这方/.test(text)) return 0
  return fallback
}

function clampScore(score) {
  return Math.max(0, Math.min(1, score))
}

function snippetAround(text, index = 0, length = 0) {
  if (!Number.isFinite(index)) return String(text ?? '').slice(0, 120)
  const start = Math.max(0, index - 24)
  const end = Math.min(String(text ?? '').length, index + length + 48)
  return String(text ?? '').slice(start, end)
}

function normalizeText(value) {
  return String(value ?? '').replace(/[\s·]/g, '').trim()
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        substitution,
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length]
}
