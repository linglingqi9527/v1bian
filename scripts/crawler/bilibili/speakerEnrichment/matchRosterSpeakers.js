import { pinyin } from 'pinyin-pro'

const MIN_MATCH_SCORE = 0.8
const MIN_SCORE_MARGIN = 0.08
const MAX_SPEAKERS_PER_TEAM = 4
const MAX_ROLE_MARKERS = 16
const MAX_SEGMENT_CHARS = 56

export function matchRosterSpeakers({ rosterContext, transcriptText = '' }) {
  const introText = extractIntroductionText(transcriptText)
  const segments = extractRoleFollowingSegments(introText)
  const members = flattenRosterMembers(rosterContext.teams)
  const candidates = segments
    .map((segment) => bestRosterCandidate(segment, members))
    .filter(Boolean)
  const assignments = selectGlobalAssignments(candidates, rosterContext.teams.length)
  const teams = rosterContext.teams.map((team, teamIndex) => ({
    team: team.rosterTeam,
    speakers: assignments
      .filter((assignment) => assignment.teamIndex === teamIndex)
      .map(toSpeakerResult),
  }))
  const speakerCount = teams.reduce((total, team) => total + team.speakers.length, 0)
  const warnings = []

  if (segments.length === 0) warnings.push('自我介绍区间内没有识别到“一辩/二辩/三辩/四辩”标记。')
  if (speakerCount === 0) warnings.push('转写成功，但没有与双方报名名单形成可靠匹配。')
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

function extractIntroductionText(value) {
  const text = normalizeTranscript(value)
  const endMatch = /在\s*认识了?\s*双方\s*辩手\s*之后|比赛.{0,4}正[式是]\s*开始|首先.{0,8}[陈臣陳][词茨司茲]/.exec(text)
  const endIndex = endMatch?.index ?? Math.min(text.length, 3000)
  return text.slice(0, endIndex)
}

function normalizeTranscript(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\u00a0]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[雙双]/g, '双')
    .replace(/[認认]識/g, '认识')
    .replace(/[辯辨變变]手/g, '辩手')
    .replace(/[一壹1]\s*[辩辯辨遍變变便]/g, '一辩')
    .replace(/[二贰兩两而2]\s*[辩辯辨遍變变便]/g, '二辩')
    .replace(/[三叁3]\s*[辩辯辨遍變变便]/g, '三辩')
    .replace(/[四肆4]\s*[辩辯辨遍變变便]/g, '四辩')
    .replace(/比賽/g, '比赛')
    .replace(/開始/g, '开始')
    .trim()
}

function extractRoleFollowingSegments(text) {
  const markers = [...text.matchAll(/一辩|二辩|三辩|四辩/g)].slice(0, MAX_ROLE_MARKERS)
  return markers.map((marker, index) => {
    const start = marker.index + marker[0].length
    const nextMarkerIndex = markers[index + 1]?.index ?? text.length
    const end = Math.min(nextMarkerIndex, start + MAX_SEGMENT_CHARS)
    return {
      id: index,
      text: text.slice(start, end),
      transcriptSnippet: text.slice(Math.max(0, marker.index - 12), Math.min(text.length, end + 12)),
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
      transcriptSnippet: segment.transcriptSnippet,
    }))
    .sort((left, right) => right.score - left.score)
  const best = ranked[0]
  const second = ranked[1]

  if (!best || best.score < MIN_MATCH_SCORE) return null
  if (second && best.score - second.score < MIN_SCORE_MARGIN) return null
  return best
}

function compareSegmentToName(segmentText, officialName) {
  const officialLength = normalizeText(officialName).length
  const windows = candidateWindows(segmentText, officialLength)
  return windows
    .map((recognizedText) => ({ recognizedText, ...compareNames(recognizedText, officialName) }))
    .sort((left, right) => right.score - left.score)[0]
    ?? { method: 'none', recognizedText: '', score: 0 }
}

function candidateWindows(value, officialLength) {
  const chinese = String(value ?? '').replace(/[^\u4e00-\u9fff·]/g, '')
  const lengths = [...new Set([officialLength, officialLength + 1])]
  const windows = []
  for (const length of lengths) {
    for (let index = 0; index <= Math.min(chinese.length - length, 32); index += 1) {
      windows.push(chinese.slice(index, index + length))
    }
  }
  return windows
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
  if (pinyinSimilarity === 1) return { method: 'pinyin', score: 0.96 }
  if (
    leftPinyin.length === rightPinyin.length
    && averageSyllableSimilarity(leftPinyin, rightPinyin) >= 0.8
  ) {
    return { method: 'pinyin-fuzzy', score: 0.88 }
  }
  if (pinyinSimilarity >= 2 / 3) return { method: 'pinyin-fuzzy', score: 0.82 }
  return { method: 'none', score: 0 }
}

function averageSyllableSimilarity(left, right) {
  const total = left.reduce((sum, syllable, index) => {
    const counterpart = right[index]
    const distance = levenshteinDistance(syllable, counterpart)
    return sum + 1 - distance / Math.max(syllable.length, counterpart.length)
  }, 0)
  return total / left.length
}

function selectGlobalAssignments(candidates, teamCount) {
  const best = searchAssignments(candidates, 0, new Set(), Array(teamCount).fill(0))
  return best.assignments
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
    recognizedText: assignment.recognizedText,
    confidence: Number(assignment.score.toFixed(2)),
    confidenceLevel: assignment.score >= 0.9 ? 'high' : 'medium',
    matchMethod: assignment.method,
    transcriptSnippet: assignment.transcriptSnippet,
  }
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
