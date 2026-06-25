import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  delay,
  fetchAllUploaderVideos,
  fetchOfficialSeasonVideos,
  fetchOfficialVideosBySearch,
  fetchTargetedOfficialSearchVideos,
  fetchVideoDetail,
  getKnownSupplementVideos,
  XIN_GUO_BIAN_MID,
  XIN_GUO_BIAN_SPACE_URL,
} from './bilibiliApi.js'
import { normalizeMatch, mergeGeneratedMatchState } from './normalizeMatch.js'
import { parseBilibiliDescription } from './parseBilibiliDescription.js'
import {
  excludeMiddleSchoolCompetitionVideos,
  filterVideosByYears,
  isLikelyMatchVideo,
  isMiddleSchoolCompetitionVideo,
} from './matchVideoFilter.js'
import { readCachedOfficialVideos } from './searchCache.js'
import { expandMultipartVideos } from './expandMultipartVideos.js'
import { readCachedSeasonVideos } from './seasonArchiveCache.js'
import { mergeVideoSources } from './videoSources.js'
import { createCrawlerReports } from './crawlerReports.js'

const ROOT_DIR = fileURLToPath(new URL('../../../', import.meta.url))
const OUTPUT_DIR = path.join(ROOT_DIR, 'src', 'data', 'generated')
const RAW_OUTPUT_PATH = path.join(OUTPUT_DIR, 'rawBilibiliVideos.json')
const MATCH_OUTPUT_PATH = path.join(OUTPUT_DIR, 'generatedMatches.json')
const DATA_REPORT_PATH = path.join(OUTPUT_DIR, 'crawlerDataReport.json')
const MISSING_SPEAKER_REPORT_PATH = path.join(OUTPUT_DIR, 'missingSpeakerReport.json')
const SEARCH_CACHE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '.cache')

const options = {
  delayMs: readPositiveInteger('BILIBILI_DELAY_MS', 900),
  maxPages: readOptionalLimit('BILIBILI_MAX_PAGES'),
  maxVideos: readOptionalLimit('BILIBILI_MAX_VIDEOS'),
  includeMiddleSchool: readBoolean('BILIBILI_INCLUDE_MIDDLE_SCHOOL', false),
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
  const videosInSelectedYears = filterVideosByYears(listedVideos, options.years)
  const middleSchoolVideos = videosInSelectedYears.filter(isMiddleSchoolCompetitionVideo)
  const scopedVideos = options.includeMiddleSchool
    ? videosInSelectedYears
    : excludeMiddleSchoolCompetitionVideos(videosInSelectedYears)
  const selectedVideos = scopedVideos.slice(0, options.maxVideos)
  const excludedMiddleSchoolMatchCount = options.includeMiddleSchool
    ? 0
    : expandMultipartVideos(middleSchoolVideos).length
  if (!options.includeMiddleSchool) {
    console.log(
      `[crawl:xgb] 已排除中学组：${middleSchoolVideos.length} 个源视频，${excludedMiddleSchoolMatchCount} 个比赛候选。`,
    )
  }
  console.log(`[crawl:xgb] 2023-2026 候选视频：${selectedVideos.length} 条。`)

  const detailedVideos = []
  let detailFailures = 0

  for (const [index, video] of selectedVideos.entries()) {
    if (options.source === 'cache' || hasUsefulDescription(video)) {
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

  const referencedVideos = await fetchReferencedVideos(detailedVideos)
  if (referencedVideos.length > 0) {
    detailedVideos.push(...referencedVideos)
    console.log(`[crawl:xgb] 简介同组 BV 扩展：新增 ${referencedVideos.length} 条。`)
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
  const { dataReport, missingSpeakerReport } = createCrawlerReports({
    candidateVideos: matchVideos,
    matches: mergedMatches,
    normalizedMatches,
    rawVideos: detailedVideos,
    scopeExclusions: {
      middleSchoolMatchCandidateCount: excludedMiddleSchoolMatchCount,
      middleSchoolSourceVideoCount: options.includeMiddleSchool ? 0 : middleSchoolVideos.length,
    },
  })

  await mkdir(OUTPUT_DIR, { recursive: true })
  await Promise.all([
    writeJsonAtomic(RAW_OUTPUT_PATH, detailedVideos),
    writeJsonAtomic(MATCH_OUTPUT_PATH, mergedMatches),
    writeJsonAtomic(DATA_REPORT_PATH, dataReport),
    writeJsonAtomic(MISSING_SPEAKER_REPORT_PATH, missingSpeakerReport),
  ])

  const warnings = mergedMatches.reduce(
    (count, match) => count + (match.raw?.parseWarnings?.length ?? 0),
    0,
  )
  console.log(`[crawl:xgb] 已写入 ${path.relative(ROOT_DIR, RAW_OUTPUT_PATH)}`)
  console.log(`[crawl:xgb] 已写入 ${path.relative(ROOT_DIR, MATCH_OUTPUT_PATH)}`)
  console.log(`[crawl:xgb] 已写入 ${path.relative(ROOT_DIR, DATA_REPORT_PATH)}`)
  console.log(`[crawl:xgb] 已写入 ${path.relative(ROOT_DIR, MISSING_SPEAKER_REPORT_PATH)}`)
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
  let uploaderVideos = []
  let searchVideos = []
  let targetedSearchVideos = []
  let cachedVideos = []
  const knownSupplementVideos = getKnownSupplementVideos({ years: options.years })

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
    uploaderVideos = await fetchAllUploaderVideos({
      delayMs: options.delayMs,
      maxPages: options.maxPages,
      mid: XIN_GUO_BIAN_MID,
      pageSize: options.pageSize,
    })
    console.log(`[crawl:xgb] 空间投稿列表获取完成：${uploaderVideos.length} 条。`)
  } catch (error) {
    console.warn(`[crawl:xgb] 空间投稿列表不可用：${error?.message ?? error}`)
  }

  try {
    searchVideos = await fetchOfficialVideosBySearch({
      delayMs: options.delayMs,
      maxPagesPerYear: options.searchMaxPages,
      mid: XIN_GUO_BIAN_MID,
      years: options.years,
    })
    console.log(`[crawl:xgb] 分年公开搜索获取完成：${searchVideos.length} 条。`)
  } catch (error) {
    console.warn(`[crawl:xgb] 分年公开搜索不可用：${error?.message ?? error}`)
  }

  try {
    targetedSearchVideos = await fetchTargetedOfficialSearchVideos({
      delayMs: options.delayMs,
      mid: XIN_GUO_BIAN_MID,
      years: options.years,
    })
    console.log(`[crawl:xgb] 目标关键词搜索获取完成：${targetedSearchVideos.length} 条。`)
  } catch (error) {
    console.warn(`[crawl:xgb] 目标关键词搜索不可用：${error?.message ?? error}`)
  }

  try {
    cachedVideos = await readVideoListFromCache()
  } catch (error) {
    console.warn(`[crawl:xgb] 本地公开缓存不可用：${error?.message ?? error}`)
  }

  const videos = mergeVideoSources(
    cachedVideos,
    seasonVideos,
    uploaderVideos,
    searchVideos,
    targetedSearchVideos,
    knownSupplementVideos,
  )
  if (videos.length === 0) throw new Error('所有在线来源和本地缓存都没有目标账号的有效视频。')
  return videos
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

function readBoolean(name, fallback) {
  const value = String(process.env[name] ?? '').trim().toLowerCase()
  if (['1', 'true', 'yes'].includes(value)) return true
  if (['0', 'false', 'no'].includes(value)) return false
  return fallback
}

function hasUsefulDescription(video) {
  const description = String(video.description ?? video.desc ?? '')
  return description.length > 20 && /新国辩|辩手|正方|反方/.test(description)
}

async function fetchReferencedVideos(videos) {
  const videosByBvid = new Map(videos.filter((video) => video?.bvid).map((video) => [video.bvid, video]))
  const referencedVideos = []
  const pendingBvids = collectReferencedBvids(videos).filter((bvid) => !videosByBvid.has(bvid))

  for (const [index, bvid] of pendingBvids.entries()) {
    try {
      const detail = await fetchVideoDetail(bvid)
      const corpus = `${detail.title ?? ''}\n${detail.description ?? detail.desc ?? ''}`
      if (!/新国辩/.test(corpus)) continue

      videosByBvid.set(bvid, detail)
      referencedVideos.push({
        ...detail,
        source: 'description-reference',
      })
      console.log(`[crawl:xgb] 引用详情 ${index + 1}/${pendingBvids.length}: ${bvid}`)
    } catch (error) {
      console.warn(`[crawl:xgb] 引用详情失败 ${bvid}: ${error?.message ?? error}`)
    }

    if (index < pendingBvids.length - 1) await delay(options.delayMs)
  }

  return referencedVideos
}

function collectReferencedBvids(videos) {
  const bvids = []
  for (const video of videos) {
    const text = `${video.description ?? ''}\n${video.desc ?? ''}\n${video.rawDescription ?? ''}`
    for (const match of text.matchAll(/BV[a-zA-Z0-9]{10}/g)) bvids.push(match[0])
  }
  return [...new Set(bvids)]
}
