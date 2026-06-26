import { access, mkdir, readdir } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { AUDIO_CACHE_DIR } from './selectSpeakerTargets.js'

const INSTALL_HINTS = {
  'yt-dlp': '请安装 yt-dlp：winget install yt-dlp.yt-dlp',
  ffmpeg: '请安装 ffmpeg：winget install Gyan.FFmpeg',
}
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'

export function checkAudioDependencies() {
  const ffmpegCommand = audioCommand('ffmpeg')
  const ytdlpCommand = audioCommand('yt-dlp')
  return {
    curl: commandExists('curl.exe', ['--version']),
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
      missingDependencies.map((name) => INSTALL_HINTS[name]),
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
  const responseText = await runCommand('curl.exe', [
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
  if (command === 'ffmpeg') return process.env.FFMPEG_BIN || 'ffmpeg'
  if (command === 'yt-dlp') return process.env.YTDLP_BIN || 'yt-dlp'
  return command
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
