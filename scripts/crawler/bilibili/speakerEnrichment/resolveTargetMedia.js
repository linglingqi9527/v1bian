import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fetchVideoDetail } from '../bilibiliApi.js'
import { SPEAKER_CACHE_DIR } from './selectSpeakerTargets.js'

export async function resolveTargetMedia(target) {
  if (target.cid) return target

  const cachePath = path.join(SPEAKER_CACHE_DIR, `detail-${target.bvId}.json`)
  const detail = await readCachedDetail(cachePath) ?? await fetchAndCacheDetail(target.bvId, cachePath)
  const pages = Array.isArray(detail?.pages) ? detail.pages : []
  const page = pages.find((item) => Number(item.page ?? 1) === target.partIndex) ?? pages[0]
  const cid = page?.cid ?? null
  const warnings = target.warnings.filter((warning) => !warning.startsWith('缺少 cid'))
  if (!cid) warnings.push(`视频详情 ${target.bvId} 没有可用 CID，音频定位可能失败。`)

  return { ...target, cid, warnings }
}

async function readCachedDetail(cachePath) {
  try {
    const payload = JSON.parse(await readFile(cachePath, 'utf8'))
    return payload.data ?? payload
  } catch {
    return null
  }
}

async function fetchAndCacheDetail(bvId, cachePath) {
  const detail = await fetchVideoDetail(bvId)
  await mkdir(path.dirname(cachePath), { recursive: true })
  await writeFile(cachePath, `${JSON.stringify({ code: 0, data: detail }, null, 2)}\n`, 'utf8')
  return detail
}
