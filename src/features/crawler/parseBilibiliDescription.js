import { createMatchModel } from '../../models/matchModel.js'

export function parseBilibiliDescription(description = '') {
  const text = String(description)
  const bvId = pickFirst(text, /BV[0-9A-Za-z]+/)
  const title = pickField(text, ['辩题', '题目', '标题']) ?? ''
  const event = pickField(text, ['赛事', '比赛']) ?? ''
  const stage = pickField(text, ['阶段', '场次', '组别']) ?? ''
  const date = pickField(text, ['日期', '时间']) ?? ''
  const teams = splitTeams(pickField(text, ['对阵', '学校', '队伍']) ?? '')
  const speakers = splitNames(pickField(text, ['辩手', '选手', '队员']) ?? '')

  return createMatchModel({
    id: bvId ? `match-${bvId}` : undefined,
    title,
    event,
    stage,
    date,
    bvId,
    bilibiliUrl: bvId ? `https://www.bilibili.com/video/${bvId}` : '',
    teams,
    speakers,
    favorite: false,
    watched: false,
    reviewId: null,
    trainingIds: [],
  })
}

function pickField(text, labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*[:：]\\s*([^\\n\\r]+)`))
    if (match?.[1]) return match[1].trim()
  }

  return null
}

function pickFirst(text, pattern) {
  return text.match(pattern)?.[0] ?? ''
}

function splitTeams(value) {
  return value
    .split(/\s+(?:vs|VS|v\.s\.|V\.S\.|对|和)\s+|[、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)
}

function splitNames(value) {
  return value
    .split(/[、,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}
