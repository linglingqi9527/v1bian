import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  delay,
  fetchAllUploaderVideos,
  fetchOfficialSeasonVideos,
  fetchOfficialVideosBySearch,
  fetchVideoDetail,
  XIN_GUO_BIAN_MID,
  XIN_GUO_BIAN_SPACE_URL,
} from './bilibiliApi.js'
import { normalizeMatch, mergeGeneratedMatchState } from './normalizeMatch.js'
import { parseBilibiliDescription } from './parseBilibiliDescription.js'
import { filterVideosByYears, isLikelyMatchVideo } from './matchVideoFilter.js'
import { readCachedOfficialVideos } from './searchCache.js'
import { expandMultipartVideos } from './expandMultipartVideos.js'
import { readCachedSeasonVideos } from './seasonArchiveCache.js'
import { mergeVideoSources } from './videoSources.js'

const ROOT_DIR = fileURLToPath(new URL('../../../', import.meta.url))
const OUTPUT_DIR = path.join(ROOT_DIR, 'src', 'data', 'generated')
const RAW_OUTPUT_PATH = path.join(OUTPUT_DIR, 'rawBilibiliVideos.json')
const MATCH_OUTPUT_PATH = path.join(OUTPUT_DIR, 'generatedMatches.json')
const SEARCH_CACHE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '.cache')

const options = {
  delayMs: readPositiveInteger('BILIBILI_DELAY_MS', 900),
  maxPages: readOptionalLimit('BILIBILI_MAX_PAGES'),
  maxVideos: readOptionalLimit('BILIBILI_MAX_VIDEOS'),
  pageSize: clamp(readPositiveInteger('BILIBILI_PAGE_SIZE', 30), 1, 50),
  searchMaxPages: clamp(readPositiveInteger('BILIBILI_SEARCH_MAX_PAGES', 50), 1, 50),
  source: readSource(),
  years: readYears(),
}

main().catch((error) => {
  console.error('\n[crawl:xgb] 爬取失败，已有 JSON 未被覆盖。')
  console.error(`[crawl:xgb] ${error?.message ?? error}`)
  process.exitCode = 1
})

async function main() {
  console.log(`[crawl:xgb] 数据源：${XIN_GUO_BIAN_SPACE_URL} (mid=${XIN_GUO_BIAN_MID})`)
  console.log(`[crawl:xgb] 来源模式：${options.source}`)
  console.log(`[crawl:xgb] 请求间隔：${options.delayMs}ms`)

  const listedVideos = await fetchVideoList()
  const selectedVideos = filterVideosByYears(listedVideos, options.years).slice(0, options.maxVideos)
  console.log(`[crawl:xgb] 2023-2026 候选视频：${selectedVideos.length} 条。`)

  const detailedVideos = []
  let detailFailures = 0

  for (const [index, video] of selectedVideos.entries()) {
    if (options.source === 'cache') {
      detailedVideos.push(video)
      continue
    }

    try {
      const detail = await fetchVideoDetail(video.bvid)
      detailedVideos.push({ ...video, ...detail })
      console.log(`[crawl:xgb] 详情 ${index + 1}/${selectedVideos.length}: ${video.bvid}`)
    } catch (error) {
      detailFailures += 1
      detailedVideos.push({
        ...video,
        desc: '',
        description: '',
        detailFetchError: error?.message ?? String(error),
      })
      console.warn(`[crawl:xgb] 详情失败 ${video.bvid}: ${error?.message ?? error}`)
    }

    if (index < selectedVideos.length - 1) await delay(options.delayMs)
  }

  if (detailedVideos.length > 0 && detailFailures === detailedVideos.length) {
    throw new Error('所有视频详情请求均失败，为避免用空简介覆盖已有数据，本次不写入 JSON。')
  }

  const matchVideos = expandMultipartVideos(detailedVideos)
  const multipartCount = matchVideos.length - detailedVideos.length
  if (multipartCount > 0) {
    console.log(`[crawl:xgb] 多 P 合集展开：新增 ${multipartCount} 个独立比赛分 P。`)
  }

  const existingMatches = await readJsonArray(MATCH_OUTPUT_PATH)
  const parsedVideos = matchVideos.map((video) => ({
    parsedInfo: parseBilibiliDescription(descriptionForParsing(video), video.title),
    video,
  }))
  const normalizedMatches = parsedVideos
    .filter(({ parsedInfo, video }) => isLikelyMatchVideo(video, parsedInfo))
    .map(({ parsedInfo, video }) => normalizeMatch(video, parsedInfo))
    .filter((match) => match.bvId)
  const dedupedMatches = dedupeMatches(normalizedMatches)
  const mergedMatches = mergeGeneratedMatchState(dedupedMatches, existingMatches)

  await mkdir(OUTPUT_DIR, { recursive: true })
  await Promise.all([
    writeJsonAtomic(RAW_OUTPUT_PATH, detailedVideos),
    writeJsonAtomic(MATCH_OUTPUT_PATH, mergedMatches),
  ])

  const warnings = mergedMatches.reduce(
    (count, match) => count + (match.raw?.parseWarnings?.length ?? 0),
    0,
  )
  console.log(`[crawl:xgb] 已写入 ${path.relative(ROOT_DIR, RAW_OUTPUT_PATH)}`)
  console.log(`[crawl:xgb] 已写入 ${path.relative(ROOT_DIR, MATCH_OUTPUT_PATH)}`)
  console.log(`[crawl:xgb] 生成比赛 ${mergedMatches.length} 条，解析警告 ${warnings} 条，详情失败 ${detailFailures} 条。`)
  console.log(`[crawl:xgb] 已过滤非正片候选 ${matchVideos.length - normalizedMatches.length} 条。`)
}

function descriptionForParsing(video) {
  const description = video.description ?? video.desc ?? ''
  if (!video.eventLabel || description.includes(video.eventLabel)) return description
  return `${description}\n赛事名称：${video.eventLabel}`
}

async function fetchVideoList() {
  if (options.source === 'cache') return readVideoListFromCache()

  let seasonVideos = []
  try {
    seasonVideos = await fetchOfficialSeasonVideos({
      delayMs: options.delayMs,
      mid: XIN_GUO_BIAN_MID,
      years: options.years,
    })
    console.log(`[crawl:xgb] 公开赛事合集获取完成：${seasonVideos.length} 条。`)
  } catch (error) {
    console.warn(`[crawl:xgb] 公开赛事合集不可用：${error?.message ?? error}`)
  }

  try {
    const videos = await fetchAllUploaderVideos({
      delayMs: options.delayMs,
      maxPages: options.maxPages,
      mid: XIN_GUO_BIAN_MID,
      pageSize: options.pageSize,
    })
    console.log(`[crawl:xgb] 空间投稿列表获取完成：${videos.length} 条。`)
    return mergeVideoSources(seasonVideos, videos)
  } catch (error) {
    console.warn(`[crawl:xgb] 空间投稿列表不可用：${error?.message ?? error}`)
    console.warn('[crawl:xgb] 改用分年公开视频搜索，并严格按目标 mid 过滤。')
    try {
      const videos = await fetchOfficialVideosBySearch({
        delayMs: options.delayMs,
        maxPagesPerYear: options.searchMaxPages,
        mid: XIN_GUO_BIAN_MID,
        years: options.years,
      })
      console.log(`[crawl:xgb] 搜索备用源获取完成：${videos.length} 条。`)
      return mergeVideoSources(seasonVideos, videos)
    } catch (searchError) {
      console.warn(`[crawl:xgb] 在线搜索备用源不可用：${searchError?.message ?? searchError}`)
      console.warn('[crawl:xgb] 尝试读取本地公开搜索缓存。')
      return readVideoListFromCache()
    }
  }
}

async function readVideoListFromCache() {
  const searchCache = await readCachedOfficialVideos(SEARCH_CACHE_DIR, {
    mid: XIN_GUO_BIAN_MID,
  })
  const seasonCache = await readCachedSeasonVideos(SEARCH_CACHE_DIR)
  const videos = mergeVideoSources(seasonCache.videos, searchCache.videos)
  if (videos.length === 0) throw new Error('本地搜索缓存中没有目标账号的有效视频。')
  const invalidFileCount = searchCache.invalidFileCount + seasonCache.invalidFileCount
  console.log(`[crawl:xgb] 本地公开缓存：${videos.length} 条去重视频，忽略 ${invalidFileCount} 个无效响应。`)
  return videos
}

function dedupeMatches(matches) {
  const matchesByFingerprint = new Map()
  for (const match of matches) {
    const fingerprint = [match.bvId, match.stage, match.teams.join('|'), match.title].join('::')
    if (!matchesByFingerprint.has(fingerprint)) matchesByFingerprint.set(fingerprint, match)
  }
  return [...matchesByFingerprint.values()].sort((left, right) => (
    String(right.publishedAt).localeCompare(String(left.publishedAt))
  ))
}

async function readJsonArray(filePath) {
  try {
    const payload = JSON.parse(await readFile(filePath, 'utf8'))
    return Array.isArray(payload) ? payload : []
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw new Error(`读取 ${filePath} 失败：${error?.message ?? error}`, { cause: error })
  }
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, filePath)
}

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function readOptionalLimit(name) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : Number.POSITIVE_INFINITY
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

function readYears() {
  const configuredYears = String(process.env.BILIBILI_YEARS ?? '2023,2024,2025,2026')
    .split(',')
    .map((year) => Number(year.trim()))
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100)
  return configuredYears.length > 0 ? [...new Set(configuredYears)] : [2023, 2024, 2025, 2026]
}

function readSource() {
  const source = String(process.env.BILIBILI_SOURCE ?? 'auto').toLowerCase()
  return ['auto', 'cache'].includes(source) ? source : 'auto'
}
