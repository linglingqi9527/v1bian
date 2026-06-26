import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { TRANSCRIPT_CACHE_DIR } from './selectSpeakerTargets.js'

export async function transcribeOpeningAudio(target, audioResult, {
  audioDuration = 480,
  audioStart = 0,
  cacheNamespace = '',
  force = false,
  initialPrompt = '',
  model = 'small',
} = {}) {
  const startedAt = Date.now()
  const cacheDirectory = cacheNamespace
    ? path.join(TRANSCRIPT_CACHE_DIR, safeFileName(cacheNamespace))
    : TRANSCRIPT_CACHE_DIR
  const cachePath = path.join(cacheDirectory, `${safeFileName(target.matchId)}.json`)
  const cached = await readTranscriptCache(cachePath)
  if (!force && cached?.transcriptText) {
    return { ...cached, cachePath, status: 'cached', elapsedMs: Date.now() - startedAt }
  }

  const transcript = createTranscriptRecord(target, {
    audioDuration,
    audioStart,
    initialPrompt,
    model,
  })
  const rawCachedText = await readRawWhisperText(audioResult.audioPath)
  if (!force && rawCachedText) return persistRawCache(cachePath, transcript, rawCachedText, startedAt)

  if (!['success', 'cached'].includes(audioResult.status)) {
    if (rawCachedText) return persistRawCache(cachePath, transcript, rawCachedText, startedAt)
    transcript.warnings.push(...audioResult.warnings, '音频未生成，跳过转写。')
    return persistResult(cachePath, transcript, 'failed', startedAt)
  }

  const backend = detectWhisperBackend()
  if (!backend) {
    if (rawCachedText) return persistRawCache(cachePath, transcript, rawCachedText, startedAt)
    transcript.warnings.push(
      '缺少 Whisper：请先安装 Python，再运行 pip install -U openai-whisper；或安装 faster-whisper。',
    )
    return persistResult(cachePath, transcript, 'dependency_missing', startedAt)
  }

  try {
    const transcriptText = backend.type === 'whisper-cli'
      ? await transcribeWithWhisperCli(backend, audioResult.audioPath, model, initialPrompt)
      : await transcribeWithFasterWhisper(backend.command, audioResult.audioPath, model, initialPrompt)
    transcript.transcriptText = transcriptText.trim()
    transcript.transcriptSource = 'whisper'
    if (!transcript.transcriptText) transcript.warnings.push('Whisper 未返回可用文本。')
    return persistResult(
      cachePath,
      transcript,
      transcript.transcriptText ? 'success' : 'failed',
      startedAt,
    )
  } catch (error) {
    if (rawCachedText) {
      transcript.warnings.push(`重新转写失败，已回退到 raw 缓存：${error?.message ?? String(error)}`)
      return persistRawCache(cachePath, transcript, rawCachedText, startedAt)
    }
    transcript.warnings.push(error?.message ?? String(error))
    return persistResult(cachePath, transcript, 'failed', startedAt)
  }
}

export function checkTranscriptionDependencies() {
  const whisperCli = Boolean(detectWhisperCli())
  const pythonCommand = pythonCommands()
    .find((command) => commandExists(command, ['--version'])) ?? null
  const fasterWhisper = pythonCommand
    ? commandExists(pythonCommand, ['-c', 'import faster_whisper'])
    : false
  return {
    python: Boolean(pythonCommand),
    whisper: whisperCli,
    'faster-whisper': fasterWhisper,
  }
}

function createTranscriptRecord(target, { audioDuration, audioStart, initialPrompt, model }) {
  return {
    matchId: target.matchId,
    bvId: target.bvId,
    cid: target.cid,
    partIndex: target.partIndex,
    bilibiliUrl: target.bilibiliUrl,
    title: target.title,
    year: target.year,
    audioStart,
    audioDuration,
    transcriptText: '',
    transcriptSource: 'whisper',
    model,
    initialPrompt,
    createdAt: new Date().toISOString(),
    warnings: [],
  }
}

function detectWhisperBackend() {
  const whisperCli = detectWhisperCli()
  if (whisperCli) return whisperCli
  for (const command of pythonCommands()) {
    if (commandExists(command, ['-c', 'import faster_whisper'])) {
      return { type: 'faster-whisper', command }
    }
  }
  return null
}

function detectWhisperCli() {
  const whisperCommand = process.env.WHISPER_BIN || 'whisper'
  if (commandExists(whisperCommand, ['--help'])) {
    return { type: 'whisper-cli', command: whisperCommand, prefixArgs: [] }
  }
  for (const command of pythonCommands()) {
    if (commandExists(command, ['-m', 'whisper', '--help'])) {
      return { type: 'whisper-cli', command, prefixArgs: ['-m', 'whisper'] }
    }
  }
  return null
}

function pythonCommands() {
  return [
    process.env.PYTHON_BIN,
    'python',
    'python3',
    'py',
  ].filter(Boolean)
}

async function transcribeWithWhisperCli(backend, audioPath, model, initialPrompt) {
  const rawOutputDir = path.join(TRANSCRIPT_CACHE_DIR, 'raw')
  await mkdir(rawOutputDir, { recursive: true })
  const args = [
    ...backend.prefixArgs,
    audioPath,
    '--model', model,
    '--language', 'Chinese',
    '--task', 'transcribe',
    '--output_format', 'json',
    '--output_dir', rawOutputDir,
  ]
  if (initialPrompt) args.push('--initial_prompt', initialPrompt)
  await runCommand(backend.command, args, 60 * 60 * 1000)
  const outputPath = path.join(rawOutputDir, `${path.parse(audioPath).name}.json`)
  const payload = JSON.parse(await readFile(outputPath, 'utf8'))
  return payload.text ?? ''
}

async function transcribeWithFasterWhisper(pythonCommand, audioPath, model, initialPrompt) {
  const script = [
    'import json, sys',
    'from faster_whisper import WhisperModel',
    'model = WhisperModel(sys.argv[2], device="cpu", compute_type="int8")',
    'segments, _ = model.transcribe(sys.argv[1], language="zh", vad_filter=True, initial_prompt=sys.argv[3] or None)',
    'print(json.dumps({"text": " ".join(segment.text.strip() for segment in segments)}, ensure_ascii=False))',
  ].join('; ')
  const output = await runCommand(
    pythonCommand,
    ['-c', script, audioPath, model, initialPrompt],
    60 * 60 * 1000,
    true,
  )
  return JSON.parse(output).text ?? ''
}

async function persistResult(cachePath, transcript, status, startedAt) {
  await mkdir(path.dirname(cachePath), { recursive: true })
  transcript.warnings = [...new Set(transcript.warnings.filter(Boolean))]
  await writeFile(cachePath, `${JSON.stringify(transcript, null, 2)}\n`, 'utf8')
  return { ...transcript, cachePath, status, elapsedMs: Date.now() - startedAt }
}

function persistRawCache(cachePath, transcript, transcriptText, startedAt) {
  transcript.transcriptText = transcriptText
  transcript.transcriptSource = 'whisperRawCache'
  transcript.warnings.push('使用已有 Whisper raw 缓存恢复转写文本。')
  return persistResult(cachePath, transcript, 'cached', startedAt)
}

async function readTranscriptCache(cachePath) {
  try {
    return JSON.parse(await readFile(cachePath, 'utf8'))
  } catch {
    return null
  }
}

async function readRawWhisperText(audioPath) {
  if (!audioPath) return ''
  const outputPath = path.join(
    TRANSCRIPT_CACHE_DIR,
    'raw',
    `${path.parse(audioPath).name}.json`,
  )
  try {
    const payload = JSON.parse(await readFile(outputPath, 'utf8'))
    return String(payload.text ?? '').trim()
  } catch {
    return ''
  }
}

function commandExists(command, args) {
  const check = spawnSync(command, args, { encoding: 'utf8', windowsHide: true })
  return !check.error && check.status === 0
}

function safeFileName(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, '_')
}

function runCommand(command, args, timeoutMs, captureOutput = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error(`${command} 运行超时。`))
    }, timeoutMs)
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0) resolve(captureOutput ? stdout : undefined)
      else reject(new Error(`${command} 退出码 ${code}：${stderr.trim().slice(-500)}`))
    })
  })
}
