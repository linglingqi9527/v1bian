const ACCENTS = ['yellow', 'blue', 'green']

export function normalizeMatch(video, parsedInfo = {}) {
  const bvid = video.bvid ?? ''
  const sourceKey = video.sourceKey ?? bvid
  const title = parsedInfo.debateTopic || parsedInfo.title || video.title || ''
  const watched = false

  return {
    id: `match-${sourceKey}`,
    userId: 'demo-user',
    title,
    topic: title,
    event: parsedInfo.event ?? '',
    stage: parsedInfo.stage ?? '',
    date: formatShanghaiDate(video.pubdate),
    bvId: bvid,
    bilibiliUrl: video.videoUrl ?? (bvid ? `https://www.bilibili.com/video/${bvid}` : ''),
    teams: Array.isArray(parsedInfo.teams) ? parsedInfo.teams : [],
    speakers: Array.isArray(parsedInfo.speakers) ? parsedInfo.speakers : [],
    favorite: false,
    watched,
    reviewId: null,
    trainingIds: [],
    accent: accentFromBvid(bvid),
    status: watched ? '已看' : '未看',
    sourceUrl: video.videoUrl ?? (bvid ? `https://www.bilibili.com/video/${bvid}` : ''),
    publishedAt: toIsoDate(video.pubdate),
    duration: video.duration ?? 0,
    raw: {
      ...video,
      parseWarnings: parsedInfo.parseWarnings ?? [],
      rawDescription: parsedInfo.rawDescription ?? video.description ?? video.desc ?? '',
    },
  }
}

export function mergeGeneratedMatchState(matches, existingMatches = []) {
  const existingById = new Map(
    existingMatches
      .filter((match) => match?.id)
      .map((match) => [match.id, match]),
  )

  return matches.map((match) => {
    const existing = existingById.get(match.id)
    if (!existing) return match

    const watched = Boolean(existing.watched)
    const generatedSpeakers = Array.isArray(match.speakers) ? match.speakers : []
    const existingSpeakers = Array.isArray(existing.speakers) ? existing.speakers : []
    const preserveEnrichedSpeakers = existingSpeakers.length > generatedSpeakers.length
    return {
      ...match,
      speakers: preserveEnrichedSpeakers ? existingSpeakers : generatedSpeakers,
      favorite: Boolean(existing.favorite),
      watched,
      reviewId: existing.reviewId ?? null,
      trainingIds: Array.isArray(existing.trainingIds) ? existing.trainingIds : [],
      status: watched ? '已看' : '未看',
      raw: preserveEnrichedSpeakers
        ? {
            ...(match.raw ?? {}),
            speakerEnrichment: existing.raw?.speakerEnrichment,
          }
        : match.raw,
    }
  })
}

function formatShanghaiDate(timestamp) {
  if (!Number(timestamp)) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).formatToParts(new Date(Number(timestamp) * 1000))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function toIsoDate(timestamp) {
  if (!Number(timestamp)) return ''
  return new Date(Number(timestamp) * 1000).toISOString()
}

function accentFromBvid(bvid) {
  const sum = [...String(bvid)].reduce((total, character) => total + character.charCodeAt(0), 0)
  return ACCENTS[sum % ACCENTS.length]
}
