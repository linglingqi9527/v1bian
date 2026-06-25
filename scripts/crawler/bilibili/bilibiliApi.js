import { createHash } from 'node:crypto'
import { requestJson } from './httpTransport.js'

export const XIN_GUO_BIAN_MID = '257958427'
export const XIN_GUO_BIAN_SPACE_URL = `https://space.bilibili.com/${XIN_GUO_BIAN_MID}`

const API_BASE_URL = 'https://api.bilibili.com'
const NAV_URL = `${API_BASE_URL}/x/web-interface/nav`
const SPACE_SEARCH_URL = `${API_BASE_URL}/x/space/wbi/arc/search`
const PUBLIC_SEARCH_URL = `${API_BASE_URL}/x/web-interface/search/type`
const VIDEO_VIEW_URL = `${API_BASE_URL}/x/web-interface/view`
const SEASON_LIST_URL = `${API_BASE_URL}/x/polymer/web-space/seasons_series_list`
const SEASON_ARCHIVES_URL = `${API_BASE_URL}/x/polymer/web-space/seasons_archives_list`
const DEFAULT_USER_AGENT = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  'Chrome/126.0.0.0 Safari/537.36',
].join(' ')
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
]
const KNOWN_SUPPLEMENT_VIDEOS = [
  { year: 2025, bvid: 'BV1jFccedE9o', pubdate: 1736592792 },
  { year: 2025, bvid: 'BV1jWcVeZE3j', pubdate: 1736684265 },
  { year: 2025, bvid: 'BV1YAc9eeEPC', pubdate: 1736831695 },
  { year: 2025, bvid: 'BV1KVcbeDEgX', pubdate: 1736835747 },
  { year: 2025, bvid: 'BV1ohcbeMEv4', pubdate: 1736838385 },
  { year: 2025, bvid: 'BV1L9cteeEkQ', pubdate: 1736840451 },
  { year: 2025, bvid: 'BV1p6cteVEKU', pubdate: 1736843609 },
  { year: 2025, bvid: 'BV1zActeBE4d', pubdate: 1736849109 },
  { year: 2025, bvid: 'BV1Dsc8ewE9c', pubdate: 1736856722 },
  { year: 2025, bvid: 'BV1iVc8ezEhy', pubdate: 1736862413 },
  { year: 2025, bvid: 'BV1DacaeNEMn', pubdate: 1736868700 },
  { year: 2025, bvid: 'BV1DUcheeEW4', pubdate: 1736877252 },
  { year: 2025, bvid: 'BV1PJchesE6r', pubdate: 1736921015 },
  { year: 2025, bvid: 'BV1dichekE6C', pubdate: 1736922485 },
  { year: 2025, bvid: 'BV1Y8cee5E7T', pubdate: 1736922818 },
  { year: 2025, bvid: 'BV1nocieeEaG', pubdate: 1736923905 },
  { year: 2025, bvid: 'BV12mcie6EjB', pubdate: 1736928857 },
  { year: 2025, bvid: 'BV11KcieBEan', pubdate: 1736932210 },
  { year: 2025, bvid: 'BV1otcBewE1e', pubdate: 1736945066 },
  { year: 2025, bvid: 'BV1MPcBeUEhk', pubdate: 1736949587 },
  { year: 2025, bvid: 'BV1h1c6etE42', pubdate: 1736951477 },
  { year: 2025, bvid: 'BV1yjc6e7EJY', pubdate: 1736955572 },
  { year: 2025, bvid: 'BV1z4c6e6ELG', pubdate: 1737016006 },
  { year: 2025, bvid: 'BV15ZwVebEgc', pubdate: 1737021475 },
  { year: 2025, bvid: 'BV13pwVepELf', pubdate: 1737026077 },
  { year: 2025, bvid: 'BV1tQw5eHEfv', pubdate: 1737113188 },
  { year: 2025, bvid: 'BV1ngcReUEK6', pubdate: 1737116158 },
  { year: 2025, bvid: 'BV1SicoeBEG1', pubdate: 1737120818 },
  { year: 2025, bvid: 'BV16gwKe7Eym', pubdate: 1737198503 },
  { year: 2025, bvid: 'BV1okwreGEH4', pubdate: 1737282208 },
]

let cachedMixinKey = null

export async function fetchAllUploaderVideos({
  delayMs = 900,
  maxPages = Number.POSITIVE_INFINITY,
  mid = XIN_GUO_BIAN_MID,
  pageSize = 30,
} = {}) {
  const videos = []
  let pageNumber = 1

  while (pageNumber <= maxPages) {
    const page = await fetchUploaderVideoPage({ mid, pageNumber, pageSize })

    if (pageNumber === 1 && page.videos.length === 0) {
      throw new BilibiliApiError(`UP 主 ${mid} 的投稿接口返回空列表。请检查账号、接口状态或风控提示。`)
    }

    videos.push(...page.videos)
    if (page.videos.length < pageSize || videos.length >= page.total) break

    pageNumber += 1
    await delay(delayMs)
  }

  return dedupeByBvid(videos)
}

export async function fetchUploaderVideoPage({
  mid = XIN_GUO_BIAN_MID,
  pageNumber = 1,
  pageSize = 30,
} = {}) {
  const mixinKey = await getWbiMixinKey()
  const url = createSignedUrl(SPACE_SEARCH_URL, {
    index: 1,
    keyword: '',
    mid,
    order: 'pubdate',
    order_avoided: 'true',
    platform: 'web',
    pn: pageNumber,
    ps: pageSize,
  }, mixinKey)
  const response = await fetchBilibiliJson(url, {
    label: `投稿列表第 ${pageNumber} 页`,
  })
  const list = response.data?.list?.vlist

  if (!Array.isArray(list)) {
    throw new BilibiliApiError(`投稿列表第 ${pageNumber} 页缺少 data.list.vlist。`)
  }

  return {
    total: Number(response.data?.page?.count ?? list.length),
    videos: list.map(normalizeVideoListItem),
  }
}

export async function fetchOfficialVideosBySearch({
  delayMs = 900,
  maxPagesPerYear = 50,
  mid = XIN_GUO_BIAN_MID,
  years = [2023, 2024, 2025, 2026],
} = {}) {
  const videos = []

  for (const year of years) {
    let pageNumber = 1
    let officialEmptyStreak = 0
    let yearVideoCount = 0

    while (pageNumber <= maxPagesPerYear) {
      let page
      try {
        page = await fetchPublicSearchPage({
          keyword: `${year}新国辩`,
          pageNumber,
        })
      } catch (error) {
        if (yearVideoCount > 0) {
          console.warn(
            `[crawl:xgb] ${year} 年公开搜索第 ${pageNumber} 页失败，保留已获取的 ${yearVideoCount} 条：${error?.message ?? error}`,
          )
          break
        }

        throw error
      }
      const officialVideos = page.videos.filter((video) => (
        String(video.mid) === String(mid) && belongsToEventYear(video, year)
      ))

      videos.push(...officialVideos)
      yearVideoCount += officialVideos.length
      officialEmptyStreak = officialVideos.length === 0 ? officialEmptyStreak + 1 : 0

      if (pageNumber >= page.totalPages || page.videos.length === 0) break
      if (yearVideoCount > 0 && officialEmptyStreak >= 5) break

      pageNumber += 1
      await delay(Math.max(350, Math.floor(delayMs / 2)))
    }
  }

  const dedupedVideos = dedupeByBvid(videos)
  if (dedupedVideos.length === 0) {
    throw new BilibiliApiError(
      `公开视频搜索未找到 mid=${mid} 的 2023-2026 新国辩视频。`,
      { retryable: false },
    )
  }

  return dedupedVideos
}

export async function fetchTargetedOfficialSearchVideos({
  delayMs = 900,
  maxPagesPerQuery = 2,
  mid = XIN_GUO_BIAN_MID,
  years = [2023, 2024, 2025, 2026],
} = {}) {
  const videos = []
  const queries = buildTargetedSearchQueries(years)

  for (const [queryIndex, query] of queries.entries()) {
    const { keyword, year } = query
    let pageNumber = 1

    while (pageNumber <= maxPagesPerQuery) {
      let page
      try {
        page = await fetchPublicSearchPage({ keyword, pageNumber })
      } catch (error) {
        console.warn(
          `[crawl:xgb] 目标搜索“${keyword}”第 ${pageNumber} 页失败，跳过该页：${error?.message ?? error}`,
        )
        break
      }

      videos.push(...page.videos
        .filter((video) => (
          String(video.mid) === String(mid)
          && belongsToEventYear(video, year)
        ))
        .map((video) => ({
          ...video,
          searchKeyword: keyword,
          source: 'targeted-search',
        })))

      if (pageNumber >= page.totalPages || page.videos.length === 0) break

      pageNumber += 1
      await delay(Math.max(350, Math.floor(delayMs / 2)))
    }

    if (queryIndex < queries.length - 1) await delay(Math.max(350, Math.floor(delayMs / 2)))
  }

  return dedupeByBvid(videos)
}

export function getKnownSupplementVideos({
  years = [2023, 2024, 2025, 2026],
} = {}) {
  const allowedYears = new Set(years.map(Number))
  return KNOWN_SUPPLEMENT_VIDEOS
    .filter((video) => allowedYears.has(video.year))
    .map((video) => ({
      aid: 0,
      author: 'bilibili新国辩',
      bvid: video.bvid,
      description: `赛事名称：${video.year}新国辩`,
      duration: 0,
      eventLabel: `${video.year}新国辩`,
      pubdate: video.pubdate,
      source: 'known-supplement',
      title: `${video.year}新国辩补充视频 ${video.bvid}`,
      videoUrl: `https://www.bilibili.com/video/${video.bvid}`,
    }))
}

export async function fetchOfficialSeasonVideos({
  delayMs = 900,
  mid = XIN_GUO_BIAN_MID,
  years = [2023, 2024, 2025, 2026],
} = {}) {
  const listUrl = new URL(SEASON_LIST_URL)
  listUrl.searchParams.set('mid', String(mid))
  listUrl.searchParams.set('page_num', '1')
  listUrl.searchParams.set('page_size', '50')
  const listResponse = await fetchBilibiliJson(listUrl, {
    label: '公开赛事合集列表',
    referer: `https://space.bilibili.com/${mid}/channel/series`,
  })
  const seasons = listResponse.data?.items_lists?.seasons_list
  if (!Array.isArray(seasons)) throw new BilibiliApiError('公开合集接口缺少 seasons_list。')

  const allowedYears = new Set(years.map(Number))
  const targetSeasons = seasons.filter(({ meta }) => allowedYears.has(eventYearFromSeason(meta)))
  const videos = []

  for (const [seasonIndex, season] of targetSeasons.entries()) {
    const pageSize = 100
    const totalPages = Math.max(1, Math.ceil(Number(season.meta?.total ?? 0) / pageSize))

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const page = await fetchSeasonArchivePage({
        mid,
        pageNumber,
        pageSize,
        seasonId: season.meta.season_id,
      })
      videos.push(...page.archives.map((archive) => normalizeSeasonArchive(archive, page.meta)))
      if (pageNumber < totalPages) await delay(Math.max(350, Math.floor(delayMs / 2)))
    }

    if (seasonIndex < targetSeasons.length - 1) await delay(Math.max(350, Math.floor(delayMs / 2)))
  }

  return dedupeByBvid(videos)
}

async function fetchSeasonArchivePage({ mid, pageNumber, pageSize, seasonId }) {
  const url = new URL(SEASON_ARCHIVES_URL)
  url.searchParams.set('mid', String(mid))
  url.searchParams.set('season_id', String(seasonId))
  url.searchParams.set('sort_reverse', 'false')
  url.searchParams.set('page_num', String(pageNumber))
  url.searchParams.set('page_size', String(pageSize))
  const response = await fetchBilibiliJson(url, {
    label: `公开合集 ${seasonId} 第 ${pageNumber} 页`,
    referer: `https://space.bilibili.com/${mid}/channel/collectiondetail?sid=${seasonId}`,
  })
  const archives = response.data?.archives
  if (!Array.isArray(archives)) throw new BilibiliApiError(`公开合集 ${seasonId} 缺少 archives。`)
  return { archives, meta: response.data?.meta ?? {} }
}

export async function fetchPublicSearchPage({ keyword, pageNumber = 1 } = {}) {
  const url = new URL(PUBLIC_SEARCH_URL)
  url.searchParams.set('search_type', 'video')
  url.searchParams.set('keyword', keyword)
  url.searchParams.set('order', 'pubdate')
  url.searchParams.set('page', String(pageNumber))
  const response = await fetchBilibiliJson(url, {
    label: `公开视频搜索“${keyword}”第 ${pageNumber} 页`,
    referer: `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`,
  })
  const results = response.data?.result

  if (!Array.isArray(results)) {
    throw new BilibiliApiError(`公开视频搜索“${keyword}”第 ${pageNumber} 页缺少 data.result。`)
  }

  return {
    totalPages: Math.min(50, Number(response.data?.numPages ?? 1)),
    videos: results.map(normalizeSearchVideoItem),
  }
}

export async function fetchVideoDetail(bvid) {
  if (!bvid) throw new BilibiliApiError('获取视频详情时缺少 bvid。')

  const url = new URL(VIDEO_VIEW_URL)
  url.searchParams.set('bvid', bvid)
  const response = await fetchBilibiliJson(url, {
    label: `视频详情 ${bvid}`,
    referer: `https://www.bilibili.com/video/${bvid}`,
  })
  const video = response.data

  if (!video?.bvid) {
    throw new BilibiliApiError(`视频详情 ${bvid} 缺少有效 data。`)
  }

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
}

export function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, milliseconds)))
}

async function getWbiMixinKey() {
  if (cachedMixinKey) return cachedMixinKey

  const response = await fetchBilibiliJson(NAV_URL, {
    acceptedCodes: [0, -101],
    label: 'WBI 签名信息',
  })
  const imageUrl = response.data?.wbi_img?.img_url
  const subUrl = response.data?.wbi_img?.sub_url

  if (!imageUrl || !subUrl) {
    throw new BilibiliApiError('B站公开 nav 接口未返回 WBI 签名图片地址，无法请求投稿列表。')
  }

  const originKey = `${fileStem(imageUrl)}${fileStem(subUrl)}`
  cachedMixinKey = MIXIN_KEY_ENC_TAB.map((index) => originKey[index]).join('').slice(0, 32)
  return cachedMixinKey
}

function createSignedUrl(baseUrl, params, mixinKey) {
  const wts = Math.floor(Date.now() / 1000)
  const sortedParams = Object.entries({ ...params, wts })
    .sort(([left], [right]) => left.localeCompare(right))
  const query = sortedParams
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(sanitizeWbiValue(value))}`)
    .join('&')
  const signature = createHash('md5').update(`${query}${mixinKey}`).digest('hex')
  return `${baseUrl}?${query}&w_rid=${signature}`
}

async function fetchBilibiliJson(url, {
  acceptedCodes = [0],
  label = 'B站接口',
  referer = XIN_GUO_BIAN_SPACE_URL,
  retries = 2,
  timeoutMs = 15000,
} = {}) {
  let lastError = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await requestJson(url, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          Origin: new URL(referer).origin,
          Referer: referer,
          'User-Agent': DEFAULT_USER_AGENT,
        },
        label,
        timeoutMs,
      })

      if (response.status < 200 || response.status >= 300) {
        throw httpError(response.status, label)
      }

      const payload = response.payload
      if (!acceptedCodes.includes(payload.code)) {
        throw apiCodeError(payload.code, payload.message, label)
      }

      return payload
    } catch (error) {
      lastError = normalizeRequestError(error, label)
      if (!shouldRetry(lastError) || attempt === retries) break
      await delay(700 * (attempt + 1))
    }
  }

  throw lastError
}

function normalizeVideoListItem(video) {
  const pubdate = Number(video.created ?? video.pubdate ?? 0)
  return {
    aid: Number(video.aid ?? 0),
    author: video.author ?? '',
    bvid: video.bvid ?? '',
    duration: video.length ?? video.duration ?? '',
    pubdate,
    title: video.title ?? '',
    videoUrl: video.bvid ? `https://www.bilibili.com/video/${video.bvid}` : '',
  }
}

export function normalizeSearchVideoItem(video) {
  const bvid = video.bvid ?? ''
  return {
    aid: Number(video.aid ?? 0),
    author: video.author ?? '',
    bvid,
    description: stripHtml(video.description ?? ''),
    duration: video.duration ?? '',
    mid: String(video.mid ?? ''),
    pubdate: Number(video.pubdate ?? 0),
    title: stripHtml(video.title ?? ''),
    videoUrl: bvid ? `https://www.bilibili.com/video/${bvid}` : '',
  }
}

export function normalizeSeasonArchive(archive, meta = {}) {
  const bvid = archive.bvid ?? ''
  const eventYear = eventYearFromSeason(meta)
  const eventLabel = eventYear ? `${eventYear}新国辩` : meta.title ?? ''
  return {
    aid: Number(archive.aid ?? 0),
    author: '',
    bvid,
    description: `赛事名称：${eventLabel}\n合集：${meta.title ?? ''}`,
    duration: Number(archive.duration ?? 0),
    eventLabel,
    mid: String(meta.mid ?? XIN_GUO_BIAN_MID),
    pubdate: Number(archive.pubdate ?? 0),
    seasonId: Number(meta.season_id ?? 0),
    seasonTitle: meta.title ?? '',
    title: stripHtml(archive.title ?? ''),
    videoUrl: bvid ? `https://www.bilibili.com/video/${bvid}` : '',
  }
}

function eventYearFromSeason(meta = {}) {
  const title = `${meta.title ?? ''} ${meta.name ?? ''}`
  const explicitYear = Number(title.match(/20(?:23|24|25|26)/)?.[0] ?? 0)
  if (explicitYear) return explicitYear
  if (/第十届新国辩/.test(title)) return 2023
  if (/第十一届新国辩/.test(title)) return 2024
  return 0
}

function dedupeByBvid(videos) {
  const uniqueVideos = new Map()
  for (const video of videos) {
    if (video.bvid && !uniqueVideos.has(video.bvid)) uniqueVideos.set(video.bvid, video)
  }
  return [...uniqueVideos.values()]
}

function fileStem(url) {
  return new URL(url).pathname.split('/').pop()?.split('.')[0] ?? ''
}

function sanitizeWbiValue(value) {
  return String(value).replace(/[!'()*]/g, '')
}

function belongsToEventYear(video, year) {
  const corpus = `${video.title}\n${video.description}`
  const explicitYears = corpus.match(/20(?:23|24|25|26)/g) ?? []
  if (explicitYears.length > 0) return explicitYears.includes(String(year))
  return shanghaiYear(video.pubdate) === Number(year)
}

function buildTargetedSearchQueries(years) {
  const groups = 'ABCDEFGHIJKL'.split('')
  const stageFragments = [
    '高校组 初赛',
    '高校组 半决赛',
    '高校组 决赛',
    '国际华语辩论邀请赛',
  ]
  const invitationTopicFragments = [
    '互联网上 共情能力',
    '幸福若退让',
    '面对原生家庭迟来的爱和关心',
    '预制菜 特殊标注',
    '卫生巾塌房',
    '内娱没有活人',
    '对加害者 事出有因',
    '运动员偶像化',
  ]
  const queries = []

  for (const year of years.map(Number)) {
    if (year !== 2025) continue

    const base = `${year}bilibili新国辩`
    queries.push(...stageFragments.map((fragment) => ({ keyword: `${base} ${fragment}`, year })))
    queries.push(...groups.map((group) => ({ keyword: `${base} 高校组 初赛${group}组`, year })))
    queries.push(...invitationTopicFragments.map((fragment) => ({ keyword: `${base} ${fragment}`, year })))
  }

  return [...new Map(queries.map((query) => [query.keyword, query])).values()]
}

function shanghaiYear(timestamp) {
  if (!Number(timestamp)) return 0
  return Number(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).format(new Date(Number(timestamp) * 1000)))
}

function stripHtml(value) {
  return String(value)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function httpError(status, label) {
  if (status === 403 || status === 412 || status === 429) {
    return new BilibiliApiError(
      `${label}返回 HTTP ${status}，请求可能受到 B 站风控或频率限制。脚本不会绕过风控，请稍后重试或降低频率。`,
      { retryable: false, status },
    )
  }

  return new BilibiliApiError(`${label}返回 HTTP ${status}。`, {
    retryable: status >= 500,
    status,
  })
}

function apiCodeError(code, message, label) {
  if (code === -352 || code === -412) {
    return new BilibiliApiError(
      `${label}被 B 站风控拒绝（code ${code}: ${message || '无详细信息'}）。脚本未使用 Cookie，也不会尝试绕过。`,
      { code, retryable: false },
    )
  }

  return new BilibiliApiError(`${label}失败（code ${code}: ${message || '无详细信息'}）。`, {
    code,
    retryable: false,
  })
}

function normalizeRequestError(error, label) {
  if (error instanceof BilibiliApiError) return error
  return new BilibiliApiError(`${label}网络请求失败：${error?.message ?? String(error)}`, {
    retryable: error?.retryable ?? true,
  })
}

function shouldRetry(error) {
  return Boolean(error?.retryable)
}

export class BilibiliApiError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'BilibiliApiError'
    Object.assign(this, details)
  }
}
