import { mkdir, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { delay, fetchVideoDetail } from './bilibiliApi.js'

const ROOT_DIR = fileURLToPath(new URL('../../../', import.meta.url))
const RAW_INPUT_PATH = path.join(ROOT_DIR, 'src', 'data', 'generated', 'rawBilibiliVideos.json')
const CACHE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '.cache')
const years = new Set(readYears())
const delayMs = readPositiveInteger('BILIBILI_DELAY_MS', 650)
const maxVideos = readOptionalLimit('BILIBILI_MAX_VIDEOS')

main().catch((error) => {
  console.error(`[crawl:xgb:details] ${error?.message ?? error}`)
  process.exitCode = 1
})

async function main() {
  const videos = JSON.parse(await readFile(RAW_INPUT_PATH, 'utf8'))
  const missingVideos = dedupeByBvid(videos)
    .filter((video) => years.has(eventYear(video)))
    .filter((video) => !hasUsefulDescription(video))
    .slice(0, maxVideos)

  console.log(`[crawl:xgb:details] 待补全公开详情：${missingVideos.length} 条。`)
  await mkdir(CACHE_DIR, { recursive: true })

  let failures = 0
  for (const [index, video] of missingVideos.entries()) {
    try {
      const detail = await fetchVideoDetail(video.bvid)
      const outputPath = path.join(CACHE_DIR, `detail-${video.bvid}.json`)
      await writeFile(outputPath, `${JSON.stringify({ code: 0, data: detail }, null, 2)}\n`, 'utf8')
      console.log(`[crawl:xgb:details] ${index + 1}/${missingVideos.length} ${video.bvid}`)
    } catch (error) {
      failures += 1
      console.warn(`[crawl:xgb:details] 失败 ${video.bvid}: ${error?.message ?? error}`)
    }
    if (index < missingVideos.length - 1) await delay(delayMs)
  }

  console.log(`[crawl:xgb:details] 完成 ${missingVideos.length - failures} 条，失败 ${failures} 条。`)
  if (failures > 0) process.exitCode = 1
}

function hasUsefulDescription(video) {
  const description = String(video.description ?? video.desc ?? '').trim()
  return description.length >= 100 && !/^赛事名称：[^\n]+\n合集：[^\n]+$/.test(description)
}

function eventYear(video) {
  const corpus = `${video.eventLabel ?? ''}\n${video.seasonTitle ?? ''}\n${video.title ?? ''}`
  return Number(corpus.match(/20(?:23|24|25|26)/)?.[0] ?? 0)
}

function dedupeByBvid(videos) {
  const uniqueVideos = new Map()
  for (const video of videos) {
    if (video?.bvid && !uniqueVideos.has(video.bvid)) uniqueVideos.set(video.bvid, video)
  }
  return [...uniqueVideos.values()]
}

function readYears() {
  return String(process.env.BILIBILI_YEARS ?? '2025,2026')
    .split(',')
    .map((year) => Number(year.trim()))
    .filter(Number.isInteger)
}

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function readOptionalLimit(name) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : Number.POSITIVE_INFINITY
}
