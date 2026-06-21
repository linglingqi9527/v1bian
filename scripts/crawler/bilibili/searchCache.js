import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { normalizeSearchVideoItem } from './bilibiliApi.js'

export async function readCachedOfficialVideos(cacheDir, { mid }) {
  const fileNames = await readdir(cacheDir)
  const videosByBvid = new Map()
  const detailsByBvid = new Map()
  let invalidFileCount = 0

  for (const fileName of fileNames.filter((name) => name.startsWith('search-') && name.endsWith('.json'))) {
    const payload = await readSearchPayload(path.join(cacheDir, fileName))
    if (!payload) {
      invalidFileCount += 1
      continue
    }

    for (const item of payload.data.result) {
      if (String(item.mid ?? '') !== String(mid)) continue
      const video = normalizeSearchVideoItem(item)
      if (!video.bvid) continue

      const existing = videosByBvid.get(video.bvid)
      if (!existing || descriptionLength(video) > descriptionLength(existing)) {
        videosByBvid.set(video.bvid, video)
      }
    }
  }

  for (const fileName of fileNames.filter((name) => name.startsWith('detail-') && name.endsWith('.json'))) {
    const detail = await readDetailPayload(path.join(cacheDir, fileName))
    if (detail?.bvid) detailsByBvid.set(detail.bvid, detail)
  }

  return {
    invalidFileCount,
    videos: [...videosByBvid.values()].map((video) => ({
      ...video,
      ...(detailsByBvid.get(video.bvid) ?? {}),
    })),
  }
}

async function readSearchPayload(filePath) {
  try {
    const payload = JSON.parse(await readFile(filePath, 'utf8'))
    if (payload.code !== 0 || !Array.isArray(payload.data?.result)) return null
    return payload
  } catch {
    return null
  }
}

async function readDetailPayload(filePath) {
  try {
    const payload = JSON.parse(await readFile(filePath, 'utf8'))
    const video = payload.code === 0 ? payload.data : null
    if (!video?.bvid) return null
    return {
      aid: Number(video.aid ?? 0),
      author: video.owner?.name ?? '',
      bvid: video.bvid,
      desc: video.desc ?? '',
      description: video.desc ?? '',
      duration: Number(video.duration ?? 0),
      owner: video.owner ?? null,
      pages: Array.isArray(video.pages) ? video.pages : [],
      pubdate: Number(video.pubdate ?? 0),
      title: video.title ?? '',
      videoUrl: `https://www.bilibili.com/video/${video.bvid}`,
    }
  } catch {
    return null
  }
}

function descriptionLength(video) {
  return String(video.description ?? '').length
}
