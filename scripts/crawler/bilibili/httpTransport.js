import { execFile } from 'node:child_process'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const STATUS_MARKER = '__BILIBILI_HTTP_STATUS__:'

export async function requestJson(url, {
  headers = {},
  label = 'HTTP 请求',
  timeoutMs = 15000,
} = {}) {
  const transport = String(process.env.BILIBILI_HTTP_TRANSPORT ?? 'fetch').toLowerCase()

  if (transport === 'curl') {
    return requestJsonWithCurl(url, { headers, label, timeoutMs })
  }

  if (transport !== 'fetch') {
    throw new HttpTransportError(
      `未知传输方式 ${transport}，请使用 fetch 或 curl。`,
      { retryable: false },
    )
  }

  return requestJsonWithFetch(url, { headers, label, timeoutMs })
}

async function requestJsonWithFetch(url, { headers, label, timeoutMs }) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    })
    const body = await response.text()
    return {
      payload: parseJson(body, label),
      status: response.status,
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new HttpTransportError(`${label}请求超过 ${timeoutMs}ms。`, {
        cause: error,
        retryable: true,
      })
    }
    throw new HttpTransportError(`${label}网络请求失败：${error?.message ?? error}`, {
      cause: error,
      retryable: true,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function requestJsonWithCurl(url, { headers, label, timeoutMs }) {
  const executable = process.platform === 'win32' ? 'curl.exe' : 'curl'
  const args = [
    '--silent',
    '--show-error',
    '--location',
    '--connect-timeout',
    String(Math.max(1, Math.ceil(timeoutMs / 2000))),
    '--max-time',
    String(Math.max(1, Math.ceil(timeoutMs / 1000))),
  ]

  for (const [name, value] of Object.entries(headers)) {
    args.push('--header', `${name}: ${value}`)
  }

  args.push('--write-out', `\n${STATUS_MARKER}%{http_code}`, String(url))

  try {
    const { stdout } = await execFileAsync(executable, args, {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      timeout: timeoutMs + 3000,
      windowsHide: true,
    })
    const markerIndex = stdout.lastIndexOf(`\n${STATUS_MARKER}`)

    if (markerIndex < 0) {
      throw new HttpTransportError(`${label}的 curl 响应缺少 HTTP 状态码。`, {
        retryable: true,
      })
    }

    const body = stdout.slice(0, markerIndex)
    const status = Number(stdout.slice(markerIndex + STATUS_MARKER.length + 1))
    return {
      payload: parseJson(body, label),
      status,
    }
  } catch (error) {
    if (error instanceof HttpTransportError) throw error
    throw new HttpTransportError(`${label}的 curl 请求失败：${error?.message ?? error}`, {
      cause: error,
      retryable: true,
    })
  }
}

function parseJson(body, label) {
  try {
    return JSON.parse(body)
  } catch (error) {
    const preview = String(body).replace(/\s+/g, ' ').slice(0, 160)
    throw new HttpTransportError(`${label}未返回 JSON：${preview || '空响应'}`, {
      cause: error,
      retryable: false,
    })
  }
}

export class HttpTransportError extends Error {
  constructor(message, details = {}) {
    super(message, details.cause ? { cause: details.cause } : undefined)
    this.name = 'HttpTransportError'
    Object.assign(this, details)
  }
}
