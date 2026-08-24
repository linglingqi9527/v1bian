import { existsSync, readdirSync } from 'node:fs'
import { access, mkdir, readdir } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { AUDIO_CACHE_DIR, ROOT_DIR } from './selectSpeakerTargets.js'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'

export function checkAudioDependencies() {
  const ffmpegCommand = audioCommand('ffmpeg')
  const ytdlpCommand = audioCommand('yt-dlp')
  return {
    curl: commandExists(audioCommand('curl'), ['--version']),
    'yt-dlp': commandExists(ytdlpCommand, ['--version']),
    ffmpeg: commandExists(ffmpegCommand, ['-version']),
  }
}

export async function extractOpeningAudio(target, {
  duration = 480,
  force = false,
  start = 0,
} = {}) {
  const startedAt = Date.now()
  const dependencies = checkAudioDependencies()
  const ytdlpCommand = audioCommand('yt-dlp')
  const missingDependencies = []
  if (!dependencies.ffmpeg) missingDependencies.push('ffmpeg')
  if (!dependencies.curl && !dependencies['yt-dlp']) missingDependencies.push('yt-dlp')
  const baseName = safeFileName(target.matchId)
  const audioPath = path.join(AUDIO_CACHE_DIR, `${baseName}.wav`)

  if (!target.processable) {
    return result('skipped', audioPath, startedAt, target.warnings)
  }

  await mkdir(AUDIO_CACHE_DIR, { recursive: true })
  if (!force && await fileExists(audioPath)) return result('cached', audioPath, startedAt)

  if (missingDependencies.length > 0) {
    return result(
      'dependency_missing',
      audioPath,
      startedAt,
      missingDependencies.map(createInstallHint),
    )
  }

  const errors = []
  if (target.cid && dependencies.curl) {
    try {
      await extractWithPublicPlayUrl(target, audioPath, { duration, start })
      return result('success', audioPath, startedAt)
    } catch (error) {
      errors.push(`公开 playurl 回退失败：${error?.message ?? error}`)
    }
  }

  const outputTemplate = path.join(AUDIO_CACHE_DIR, `${baseName}.%(ext)s`)
  const args = [
    '--no-playlist',
    '--no-progress',
    '--download-sections',
    `*${start}-${start + duration}`,
    '--force-keyframes-at-cuts',
    '--user-agent',
    USER_AGENT,
    '--referer',
    target.bilibiliUrl,
    '-f',
    'bestaudio/best',
    '-x',
    '--audio-format',
    'wav',
    '--postprocessor-args',
    'ffmpeg:-ac 1 -ar 16000',
    '-o',
    outputTemplate,
    target.bilibiliUrl,
  ]

  if (dependencies['yt-dlp']) {
    try {
      await runCommand(ytdlpCommand, args, 15 * 60 * 1000)
      const resolvedPath = await findAudioPath(baseName)
      if (!resolvedPath) throw new Error('yt-dlp 已结束，但没有找到生成的 wav 文件。')
      return result('success', resolvedPath, startedAt, errors)
    } catch (error) {
      errors.push(`yt-dlp 回退失败：${error?.message ?? error}`)
    }
  }

  return result('failed', audioPath, startedAt, errors)
}

async function extractWithPublicPlayUrl(target, audioPath, { duration, start }) {
  const apiUrl = new URL('https://api.bilibili.com/x/player/playurl')
  apiUrl.searchParams.set('bvid', target.bvId)
  apiUrl.searchParams.set('cid', String(target.cid))
  apiUrl.searchParams.set('qn', '64')
  apiUrl.searchParams.set('fnval', '0')
  apiUrl.searchParams.set('fourk', '0')
  const responseText = await runCommand(audioCommand('curl'), [
    '--connect-timeout', '5',
    '--max-time', '30',
    '--fail',
    '--silent',
    '--show-error',
    '--user-agent', USER_AGENT,
    '--referer', target.bilibiliUrl,
    String(apiUrl),
  ], 35 * 1000, true)
  const payload = JSON.parse(responseText)
  const mediaUrl = payload.code === 0 ? payload.data?.durl?.[0]?.url : null
  if (!mediaUrl) throw new Error(`B站 playurl 未返回媒体地址：${payload.message ?? payload.code}`)

  await runCommand(audioCommand('ffmpeg'), [
    '-nostdin',
    '-hide_banner',
    '-loglevel', 'error',
    '-headers', `Referer: ${target.bilibiliUrl}\r\nUser-Agent: ${USER_AGENT}\r\n`,
    '-ss', String(start),
    '-t', String(duration),
    '-i', mediaUrl,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-y',
    audioPath,
  ], 15 * 60 * 1000)
}

function audioCommand(command) {
  if (command === 'ffmpeg') return process.env.FFMPEG_BIN || resolveBundledFfmpeg() || 'ffmpeg'
  if (command === 'yt-dlp') return process.env.YTDLP_BIN || resolveVenvBinary('yt-dlp') || 'yt-dlp'
  if (command === 'curl') return process.env.CURL_BIN || (process.platform === 'win32' ? 'curl.exe' : 'curl')
  return command
}

function resolveVenvBinary(command) {
  const candidates = [
    path.join(ROOT_DIR, '.venv-asr', 'bin', command),
    path.join(ROOT_DIR, '.venv-asr', 'Scripts', `${command}.exe`),
    path.join(ROOT_DIR, '.venv-asr', 'Scripts', command),
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? ''
}

function resolveBundledFfmpeg() {
  const sitePackageRoots = [
    path.join(ROOT_DIR, '.venv-asr', 'lib'),
    path.join(ROOT_DIR, '.venv-asr', 'Lib', 'site-packages'),
  ]

  for (const root of sitePackageRoots) {
    const binary = findImageioFfmpegBinary(root)
    if (binary) return binary
  }

  return ''
}

function findImageioFfmpegBinary(root) {
  if (!existsSync(root)) return ''

  const entries = readDirectorySafe(root)
  for (const entry of entries) {
    const entryPath = path.join(root, entry)
    const candidateRoot = entry.startsWith('python')
      ? path.join(entryPath, 'site-packages', 'imageio_ffmpeg', 'binaries')
      : path.join(entryPath, 'imageio_ffmpeg', 'binaries')
    const binary = findFfmpegInDirectory(candidateRoot)
    if (binary) return binary
  }

  return findFfmpegInDirectory(path.join(root, 'imageio_ffmpeg', 'binaries'))
}

function findFfmpegInDirectory(directory) {
  return readDirectorySafe(directory)
    .map((entry) => path.join(directory, entry))
    .find((entryPath) => /ffmpeg/i.test(path.basename(entryPath)) && !entryPath.endsWith('.sha256')) ?? ''
}

function readDirectorySafe(directory) {
  try {
    return readdirSync(directory)
  } catch {
    return []
  }
}

function createInstallHint(name) {
  if (process.platform === 'darwin') return `请安装 ${name}：brew install ${name}`
  if (process.platform === 'win32') {
    if (name === 'ffmpeg') return '请安装 ffmpeg：winget install Gyan.FFmpeg'
    if (name === 'yt-dlp') return '请安装 yt-dlp：winget install yt-dlp.yt-dlp'
  }
  return `请安装 ${name}，并确保命令可以在终端直接运行。`
}

function result(status, audioPath, startedAt, warnings = []) {
  return {
    status,
    audioPath,
    elapsedMs: Date.now() - startedAt,
    warnings: [...new Set(warnings.filter(Boolean))],
  }
}

function commandExists(command, args) {
  const check = spawnSync(command, args, { encoding: 'utf8', windowsHide: true })
  return !check.error && check.status === 0
}

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function findAudioPath(baseName) {
  const files = await readdir(AUDIO_CACHE_DIR)
  const fileName = files.find((name) => name === `${baseName}.wav`)
  return fileName ? path.join(AUDIO_CACHE_DIR, fileName) : null
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
      reject(new Error(`${command} 运行超过 ${Math.round(timeoutMs / 1000)} 秒。`))
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
