import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { normalizeSeasonArchive } from './bilibiliApi.js'

export async function readCachedSeasonVideos(cacheDir) {
  const fileNames = (await readdir(cacheDir))
    .filter((name) => /^season-\d+-page-\d+\.json$/.test(name))
    .sort()
  const videos = []
  let invalidFileCount = 0

  for (const fileName of fileNames) {
    try {
      const payload = JSON.parse(await readFile(path.join(cacheDir, fileName), 'utf8'))
      const archives = payload.code === 0 ? payload.data?.archives : null
      if (!Array.isArray(archives)) throw new Error('invalid archives')
      videos.push(...archives.map((archive) => normalizeSeasonArchive(archive, payload.data?.meta)))
    } catch {
      invalidFileCount += 1
    }
  }

  return { invalidFileCount, videos }
}
