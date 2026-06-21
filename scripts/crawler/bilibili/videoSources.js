export function mergeVideoSources(...sources) {
  const videosByBvid = new Map()

  for (const video of sources.flat()) {
    if (!video?.bvid) continue
    const existing = videosByBvid.get(video.bvid)
    videosByBvid.set(video.bvid, existing ? mergeVideo(existing, video) : video)
  }

  return [...videosByBvid.values()]
}

function mergeVideo(existing, incoming) {
  const existingDescription = String(existing.description ?? existing.desc ?? '')
  const incomingDescription = String(incoming.description ?? incoming.desc ?? '')
  return {
    ...existing,
    ...incoming,
    description: incomingDescription.length > existingDescription.length
      ? incomingDescription
      : existingDescription,
    pages: pickPages(existing.pages, incoming.pages),
    title: pickRicherTitle(existing.title, incoming.title),
  }
}

function pickPages(left, right) {
  if (Array.isArray(right) && right.length > 0) return right
  return Array.isArray(left) ? left : []
}

function pickRicherTitle(left, right) {
  const candidates = [String(left ?? ''), String(right ?? '')]
  return candidates.sort((a, b) => scoreTitle(b) - scoreTitle(a))[0]
}

function scoreTitle(title) {
  return title.length + (/vs|VS|对阵/.test(title) ? 100 : 0) + (/[丨|]/.test(title) ? 20 : 0)
}
