import { mkdir, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getSpeakerStatus } from '../crawlerReports.js'
import { determineYear } from './qualificationScope.js'

export const ROOT_DIR = fileURLToPath(new URL('../../../../', import.meta.url))
export const SPEAKER_CACHE_DIR = path.join(ROOT_DIR, 'scripts', 'crawler', 'bilibili', '.cache')
export const AUDIO_CACHE_DIR = path.join(SPEAKER_CACHE_DIR, 'audio')
export const TRANSCRIPT_CACHE_DIR = path.join(SPEAKER_CACHE_DIR, 'transcripts')
export const TARGET_MANIFEST_PATH = path.join(SPEAKER_CACHE_DIR, 'speakerTargets.2025.sample.json')
export const GENERATED_DIR = path.join(ROOT_DIR, 'src', 'data', 'generated')

const MATCHES_PATH = path.join(GENERATED_DIR, 'generatedMatches.json')
const NON_MATCH_PATTERN = /预告|花絮|战报|宣传|高光|名场面|纪录片|回顾|采访/

export function getTargetManifestPath(year) {
  return path.join(SPEAKER_CACHE_DIR, `speakerTargets.${year}.sample.json`)
}

export async function selectSpeakerTargets({ limit = 10, year = 2025, write = true } = {}) {
  const matches = JSON.parse(await readFile(MATCHES_PATH, 'utf8'))
  const eligible = matches
    .filter((match) => determineYear(match) === year)
    .filter((match) => ['missing', 'partial', 'uncertain'].includes(getSpeakerStatus(match)))
    .filter((match) => Boolean(match.id && match.bvId && match.bilibiliUrl))
    .map(createTarget)
    .filter((target) => !NON_MATCH_PATTERN.test(`${target.title} ${target.stage}`))
    .sort((left, right) => targetScore(right) - targetScore(left))
  const targets = selectDiverseTargets(eligible, limit)
  const manifest = {
    schemaVersion: 1,
    selectedAt: new Date().toISOString(),
    year,
    limit,
    eligibleCount: eligible.length,
    selectionBasis: 'event 中的年份优先，date/title 作为回退；优先正式比赛、稳定 CID 和可定位分 P。',
    targets,
  }

  const targetManifestPath = getTargetManifestPath(year)

  if (write) {
    await mkdir(SPEAKER_CACHE_DIR, { recursive: true })
    await writeFile(targetManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }

  return manifest
}

export function parseCliOptions(argv = process.argv.slice(2)) {
  const options = {
    all: false,
    acceptLowConfidence: false,
    autoWindow: false,
    cleanupAudio: false,
    duration: 480,
    force: false,
    limit: 10,
    matchId: '',
    merge: false,
    maxStart: 1200,
    missingIntroOnly: false,
    model: 'small',
    start: 0,
    windowDuration: 180,
    year: 2025,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--accept-low-confidence') options.acceptLowConfidence = true
    if (argument === '--all') options.all = true
    if (argument === '--auto-window') options.autoWindow = true
    if (argument === '--cleanup-audio') options.cleanupAudio = true
    if (argument === '--force') options.force = true
    if (argument === '--missing-intro-only') options.missingIntroOnly = true
    if (argument === '--merge') options.merge = true
    if (argument === '--limit') options.limit = positiveNumber(argv[index += 1], options.limit)
    if (argument === '--match-id') options.matchId = argv[index += 1] || options.matchId
    if (argument === '--max-start') options.maxStart = nonNegativeNumber(argv[index += 1], options.maxStart)
    if (argument === '--duration') options.duration = positiveNumber(argv[index += 1], options.duration)
    if (argument === '--model') options.model = argv[index += 1] || options.model
    if (argument === '--start') options.start = nonNegativeNumber(argv[index += 1], options.start)
    if (argument === '--window-duration') {
      options.windowDuration = positiveNumber(argv[index += 1], options.windowDuration)
    }
    if (argument === '--year') options.year = positiveNumber(argv[index += 1], options.year)
  }
  return options
}

function createTarget(match) {
  const partIndex = resolvePartIndex(match)
  const pages = Array.isArray(match.raw?.pages) ? match.raw.pages : []
  const page = pages.find((item) => Number(item.page ?? 1) === partIndex) ?? pages[0]
  const cid = match.raw?.cid ?? page?.cid ?? null
  const isMultipart = partIndex > 1 || pages.length > 1 || /-p\d+$/.test(match.id)
  const warnings = []

  if (!cid) warnings.push('缺少 cid；yt-dlp 仍可尝试单 P URL，但定位可靠性降低。')
  if (isMultipart && (!cid || !partIndex)) {
    warnings.push('多 P 视频缺少 cid 或 partIndex，禁止自动处理。')
  }

  return {
    matchId: match.id,
    bvId: match.bvId,
    cid,
    partIndex,
    page: partIndex,
    bilibiliUrl: match.bilibiliUrl,
    title: match.title,
    event: match.event,
    stage: match.stage,
    date: match.date,
    teams: Array.isArray(match.teams) ? match.teams : [],
    year: determineYear(match),
    speakerStatus: getSpeakerStatus(match),
    isMultipart,
    processable: !(isMultipart && (!cid || !partIndex)),
    warnings,
  }
}

function resolvePartIndex(match) {
  const rawPart = Number(match.raw?.partNumber ?? match.raw?.page ?? 0)
  if (rawPart > 0) return rawPart
  try {
    return positiveNumber(new URL(match.bilibiliUrl).searchParams.get('p'), 1)
  } catch {
    return 1
  }
}

function targetScore(target) {
  let score = target.processable ? 100 : -100
  if (target.cid) score += 50
  if (/初赛|复赛|半决赛|决赛|晋级赛|资格赛/.test(target.stage)) score += 20
  if (target.speakerStatus === 'missing') score += 5
  return score
}

function selectDiverseTargets(targets, limit) {
  const selected = []
  const selectedIds = new Set()
  const titles = new Set()
  const stableTargets = targets.filter((target) => target.processable && target.cid)

  for (const target of stableTargets) {
    if (selected.length >= limit) break
    if (titles.has(target.title)) continue
    selected.push(target)
    selectedIds.add(target.matchId)
    titles.add(target.title)
  }
  for (const target of [...stableTargets, ...targets]) {
    if (selected.length >= limit) break
    if (selectedIds.has(target.matchId)) continue
    selected.push(target)
    selectedIds.add(target.matchId)
  }
  return selected
}

function positiveNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function nonNegativeNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

async function runCli() {
  const options = parseCliOptions()
  const manifest = await selectSpeakerTargets({ limit: options.limit, year: options.year })
  const targetManifestPath = getTargetManifestPath(options.year)
  console.log(`[speakers:select:${options.year}] 可选 ${manifest.eligibleCount} 条，已选择 ${manifest.targets.length} 条。`)
  console.log(`[speakers:select:${options.year}] ${path.relative(ROOT_DIR, targetManifestPath)}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(`[speakers:select] ${error?.message ?? error}`)
    process.exitCode = 1
  })
}
