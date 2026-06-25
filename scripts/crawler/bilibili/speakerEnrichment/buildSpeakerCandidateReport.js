import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { checkAudioDependencies, extractOpeningAudio } from './extractOpeningAudio.js'
import { parseSpeakersFromTranscript } from './parseSpeakersFromTranscript.js'
import {
  GENERATED_DIR,
  parseCliOptions,
  selectSpeakerTargets,
} from './selectSpeakerTargets.js'
import {
  checkTranscriptionDependencies,
  transcribeOpeningAudio,
} from './transcribeOpeningAudio.js'

const CANDIDATES_PATH = path.join(GENERATED_DIR, 'audioSpeakerCandidates.2025.sample.json')
const REVIEW_PATH = path.join(GENERATED_DIR, 'speakerCandidateReview.2025.sample.json')
const STILL_MISSING_PATH = path.join(GENERATED_DIR, 'audioSpeakerStillMissing.2025.sample.json')
const REPORT_PATH = path.join(GENERATED_DIR, 'speakerEnrichmentReport.2025.sample.json')

export async function buildSpeakerCandidateReport(options = {}) {
  const startedAt = Date.now()
  const manifest = await selectSpeakerTargets({ limit: options.limit ?? 10 })
  const records = []
  const dependencies = {
    ...checkAudioDependencies(),
    ...checkTranscriptionDependencies(),
  }
  const missingDependencies = []
  if (!dependencies.ffmpeg) missingDependencies.push('ffmpeg')
  if (!dependencies.curl && !dependencies['yt-dlp']) {
    missingDependencies.push('curl 或 yt-dlp')
  }
  if (!dependencies.whisper && !dependencies['faster-whisper']) {
    missingDependencies.push('whisper 或 faster-whisper')
  }
  if (missingDependencies.length > 0) {
    console.warn(
      `[speakers:audio:sample:2025] 缺少可执行依赖：${missingDependencies.join(', ')}。将生成失败报告，不会伪造转写。`,
    )
  }

  for (const [index, target] of manifest.targets.entries()) {
    const targetStartedAt = Date.now()
    console.log(`[speakers:audio:sample:2025] ${index + 1}/${manifest.targets.length} ${target.matchId}`)
    const audio = await extractOpeningAudio(target, options)
    const transcript = await transcribeOpeningAudio(target, audio, {
      audioDuration: options.duration,
      audioStart: 0,
      force: options.force,
      model: options.model,
    })
    const parsed = parseSpeakersFromTranscript(transcript.transcriptText)
    const candidates = adjustCandidatesForModel(parsed.candidates, transcript.model)
    const modelWarnings = transcript.model === 'tiny' && candidates.length > 0
      ? ['tiny 模型仅生成待复核候选，姓名可能存在同音字或错字，禁止自动合并。']
      : []
    records.push({
      matchId: target.matchId,
      bvId: target.bvId,
      cid: target.cid,
      partIndex: target.partIndex,
      bilibiliUrl: target.bilibiliUrl,
      title: target.title,
      year: target.year,
      candidates,
      warnings: uniqueWarnings([
        ...target.warnings,
        ...audio.warnings,
        ...transcript.warnings,
        ...parsed.warnings,
        ...modelWarnings,
      ]),
      audioStatus: audio.status,
      transcriptStatus: transcript.status,
      elapsedMs: Date.now() - targetStartedAt,
    })
  }

  const review = records.map((record) => ({
    ...record,
    reviewStatus: reviewStatus(record.candidates),
  }))
  const stillMissing = records.filter((record) => record.candidates.length === 0)
  const report = createReport({
    dependencies,
    duration: options.duration,
    elapsedMs: Date.now() - startedAt,
    manifest,
    records,
  })

  await mkdir(GENERATED_DIR, { recursive: true })
  await Promise.all([
    writeJson(CANDIDATES_PATH, records),
    writeJson(REVIEW_PATH, review),
    writeJson(STILL_MISSING_PATH, stillMissing),
    writeJson(REPORT_PATH, report),
  ])

  return { records, report, review, stillMissing }
}

function adjustCandidatesForModel(candidates, model) {
  if (model !== 'tiny') return candidates
  return candidates.map((candidate) => ({
    ...candidate,
    confidence: Math.min(candidate.confidence, 0.58),
    confidenceLevel: candidate.confidenceLevel === 'low' ? 'low' : 'medium',
  }))
}

function createReport({ dependencies, duration, elapsedMs, manifest, records }) {
  const allCandidates = records.flatMap((record) => record.candidates)
  const transcriptSuccessCount = records.filter((record) => (
    ['success', 'cached'].includes(record.transcriptStatus)
  )).length
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    year: 2025,
    missingSpeakerVideoCount: manifest.eligibleCount,
    sampleSize: records.length,
    selectedTargets: manifest.targets,
    audioStart: 0,
    audioDuration: duration,
    audioSuccessCount: records.filter((record) => ['success', 'cached'].includes(record.audioStatus)).length,
    transcriptionSuccessCount: transcriptSuccessCount,
    transcriptionFailureCount: records.length - transcriptSuccessCount,
    highCandidateCount: allCandidates.filter((candidate) => candidate.confidenceLevel === 'high').length,
    mediumCandidateCount: allCandidates.filter((candidate) => candidate.confidenceLevel === 'medium').length,
    lowCandidateCount: allCandidates.filter((candidate) => candidate.confidenceLevel === 'low').length,
    noSpeakerDetectedCount: records.filter((record) => record.candidates.length === 0).length,
    unstableMultipartCount: manifest.targets.filter((target) => !target.processable).length,
    averageElapsedMs: records.length > 0
      ? Math.round(records.reduce((total, record) => total + record.elapsedMs, 0) / records.length)
      : 0,
    totalElapsedMs: elapsedMs,
    failureReasons: countFailureReasons(records),
    dependencies,
    notes: [
      '本报告仅供人工复核，不会写入 generatedMatches.json。',
      '年份优先取 event，date/title 仅作为回退。',
    ],
  }
}

function countFailureReasons(records) {
  const counts = {}
  for (const warning of records.flatMap((record) => record.warnings)) {
    counts[warning] = (counts[warning] ?? 0) + 1
  }
  return counts
}

function reviewStatus(candidates) {
  if (candidates.some((candidate) => candidate.confidenceLevel === 'high')) return 'review-high'
  if (candidates.some((candidate) => candidate.confidenceLevel === 'medium')) return 'review-medium'
  if (candidates.length > 0) return 'review-low'
  return 'still-missing'
}

function uniqueWarnings(warnings) {
  return [...new Set(warnings.filter(Boolean))]
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function runCli() {
  const options = parseCliOptions()
  const { report } = await buildSpeakerCandidateReport(options)
  console.log(`[speakers:audio:sample:2025] 样本 ${report.sampleSize} 条，转写成功 ${report.transcriptionSuccessCount} 条。`)
  console.log(`[speakers:audio:sample:2025] ${path.relative(process.cwd(), REPORT_PATH)}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(`[speakers:audio:sample:2025] ${error?.message ?? error}`)
    process.exitCode = 1
  })
}
