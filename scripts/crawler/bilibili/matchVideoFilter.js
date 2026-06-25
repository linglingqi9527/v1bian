const MATCH_STAGE_PATTERN = /初赛|复赛|半决赛|决赛|资格赛|小组赛|淘汰赛|循环赛/
const MATCHUP_PATTERN = /(?:vs\.?|VS|对阵)|(?:正方[：:].*反方[：:])/s

export function isLikelyMatchVideo(video, parsedInfo) {
  const corpus = `${video.title ?? ''}\n${video.description ?? video.desc ?? ''}`
  const hasTeams = Array.isArray(parsedInfo.teams) && parsedInfo.teams.length >= 2
  const hasTopic = Boolean(parsedInfo.debateTopic)
  const hasStage = Boolean(parsedInfo.stage) || MATCH_STAGE_PATTERN.test(corpus)
  const hasMatchup = MATCHUP_PATTERN.test(corpus)
  const isLongDebate = durationInSeconds(video.duration) >= 1800
    && /新国辩/.test(corpus)
    && hasDebateChoice(parsedInfo.debateTopic)

  return hasTopic && ((hasStage && (hasTeams || hasMatchup)) || isLongDebate)
}

function hasDebateChoice(value) {
  const topic = String(value ?? '')
  return topic.includes('/') || topic.includes('／') || /应不应该|有利于|不利于|更好|更难/.test(topic)
}

function durationInSeconds(value) {
  if (Number.isFinite(Number(value))) return Number(value)
  return String(value).split(':').reduce((seconds, part) => (seconds * 60) + Number(part || 0), 0)
}

export function filterVideosByYears(videos, years) {
  const allowedYears = new Set(years.map(Number))
  return videos.filter((video) => {
    const corpus = `${video.title ?? ''}\n${video.description ?? video.desc ?? ''}`
    const explicitYear = Number(corpus.match(/20(?:23|24|25|26)/)?.[0] ?? 0)
    if (explicitYear) return allowedYears.has(explicitYear)
    return allowedYears.has(shanghaiYear(video.pubdate))
  })
}

export function isMiddleSchoolCompetitionVideo(video) {
  const corpus = [
    video.title,
    video.description ?? video.desc,
    video.eventLabel,
    video.seasonTitle,
    video.parentTitle,
  ].filter(Boolean).join('\n')

  return /中学组/.test(corpus)
}

export function excludeMiddleSchoolCompetitionVideos(videos) {
  return videos.filter((video) => !isMiddleSchoolCompetitionVideo(video))
}

function shanghaiYear(timestamp) {
  if (!Number(timestamp)) return 0
  return Number(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(new Date(Number(timestamp) * 1000)))
}
