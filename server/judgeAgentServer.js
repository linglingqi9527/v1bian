import http from 'node:http'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const MAX_BODY_BYTES = 6 * 1024 * 1024
const MAX_MODEL_OUTPUT_TOKENS = 8192

loadEnvFile(path.join(PROJECT_ROOT, '.env'))
loadEnvFile(path.join(PROJECT_ROOT, '.env.local'))

const PORT = Number(process.env.JUDGE_AGENT_PORT ?? 8787)
const HOST = process.env.JUDGE_AGENT_HOST ?? '127.0.0.1'

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
    sendJson(response, 204, null)
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/judge-agent/health') {
    sendJson(response, 200, {
      ok: true,
      configured: Boolean(process.env.JUDGE_LLM_API_KEY),
      model: resolveModel('default'),
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/judge-agent/extract-text') {
    try {
      const fileName = decodeURIComponent(String(request.headers['x-file-name'] ?? ''))
      const fileBuffer = await readRawBody(request)
      const text = extractTextFromUploadedDocument(fileName, fileBuffer)

      sendJson(response, 200, {
        fileName,
        text,
      })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : 'Document text extraction failed',
      })
    }
    return
  }

  if (request.method !== 'POST' || url.pathname !== '/api/judge-agent') {
    sendJson(response, 404, { error: 'Not found' })
    return
  }

  try {
    const payload = await readJsonBody(request)
    const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : ''
    if (!prompt) {
      sendJson(response, 400, { error: 'Missing prompt' })
      return
    }

    const report = await callOpenAICompatibleModel({
      modelProfile: payload.modelProfile,
      prompt,
      responseMode: payload.responseMode,
    })

    sendJson(response, 200, report)
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'JudgeAgent proxy failed',
    })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[judge-agent] listening on http://${HOST}:${PORT}`)
})

async function callOpenAICompatibleModel({ modelProfile, prompt, responseMode = 'json' }) {
  if (modelProfile === 'local') {
    return await callLocalOllamaModel({ prompt, responseMode })
  }

  const apiKey = String(process.env.JUDGE_LLM_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new Error('JUDGE_LLM_API_KEY is not configured')
  }

  const baseUrl = stripTrailingSlash(
    process.env.JUDGE_LLM_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  )
  const endpoint = process.env.JUDGE_LLM_CHAT_ENDPOINT ?? `${baseUrl}/chat/completions`
  const model = resolveModel(modelProfile)
  const temperature = Number(process.env.JUDGE_LLM_TEMPERATURE ?? 0.2)
  const maxTokens = normalizeMaxTokens(process.env.JUDGE_LLM_MAX_TOKENS ?? MAX_MODEL_OUTPUT_TOKENS)
  const requestBody = {
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: Number.isFinite(temperature) ? temperature : 0.2,
  }

  if (maxTokens > 0) {
    requestBody.max_tokens = maxTokens
  }

  if (process.env.JUDGE_LLM_JSON_MODE === 'true') {
    requestBody.response_format = { type: 'json_object' }
  }

  const modelResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  const responseText = await modelResponse.text()
  if (!modelResponse.ok) {
    throw new Error(`Cloud model failed: ${modelResponse.status} ${responseText.slice(0, 240)}`)
  }

  let data
  try {
    data = JSON.parse(responseText)
  } catch {
    throw new Error('Cloud model returned non-JSON response')
  }

  return parseModelContent(data?.choices?.[0]?.message?.content, responseMode)
}

async function callLocalOllamaModel({ prompt, responseMode = 'json' }) {
  const endpoint = String(
    process.env.JUDGE_OLLAMA_ENDPOINT
      ?? process.env.VITE_JUDGE_OLLAMA_ENDPOINT
      ?? 'http://localhost:11434/v1/chat/completions',
  )
  const model = String(
    process.env.JUDGE_OLLAMA_MODEL
      ?? process.env.VITE_JUDGE_OLLAMA_MODEL
      ?? 'qwen3:4b',
  )
  const maxTokens = normalizeMaxTokens(
    process.env.JUDGE_OLLAMA_MAX_TOKENS ?? process.env.JUDGE_LLM_MAX_TOKENS ?? MAX_MODEL_OUTPUT_TOKENS,
  )

  let modelResponse
  try {
    modelResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        ...(maxTokens > 0 ? { max_tokens: maxTokens } : {}),
      }),
    })
  } catch {
    throw new Error('本地模型未连接：请先启动 Ollama，并确认模型已下载。')
  }

  const responseText = await modelResponse.text()
  if (!modelResponse.ok) {
    throw new Error(`本地模型调用失败：${modelResponse.status} ${responseText.slice(0, 160)}`)
  }

  let data
  try {
    data = JSON.parse(responseText)
  } catch {
    throw new Error('本地模型返回了非 JSON 响应。')
  }

  return parseModelContent(data?.choices?.[0]?.message?.content, responseMode)
}

function extractTextFromUploadedDocument(fileName, fileBuffer) {
  const extension = fileName.split('.').pop()?.toLowerCase()

  if (extension === 'docx') {
    const xml = extractZipEntry(fileBuffer, 'word/document.xml').toString('utf8')
    return normalizeDocxText(xml)
  }

  throw new Error('当前只支持从 .docx 自动提取正文。')
}

function extractZipEntry(zipBuffer, entryName) {
  const endOffset = findEndOfCentralDirectory(zipBuffer)
  const entryCount = zipBuffer.readUInt16LE(endOffset + 10)
  const centralDirectoryOffset = zipBuffer.readUInt32LE(endOffset + 16)
  let cursor = centralDirectoryOffset

  for (let index = 0; index < entryCount; index += 1) {
    if (zipBuffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('DOCX 文件目录结构异常。')
    }

    const compressionMethod = zipBuffer.readUInt16LE(cursor + 10)
    const compressedSize = zipBuffer.readUInt32LE(cursor + 20)
    const fileNameLength = zipBuffer.readUInt16LE(cursor + 28)
    const extraLength = zipBuffer.readUInt16LE(cursor + 30)
    const commentLength = zipBuffer.readUInt16LE(cursor + 32)
    const localHeaderOffset = zipBuffer.readUInt32LE(cursor + 42)
    const currentEntryName = zipBuffer.toString('utf8', cursor + 46, cursor + 46 + fileNameLength)

    if (currentEntryName === entryName) {
      return readLocalZipEntry(zipBuffer, localHeaderOffset, compressionMethod, compressedSize)
    }

    cursor += 46 + fileNameLength + extraLength + commentLength
  }

  throw new Error('DOCX 正文不存在或文件已损坏。')
}

function readLocalZipEntry(zipBuffer, localHeaderOffset, compressionMethod, compressedSize) {
  if (zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error('DOCX 文件头异常。')
  }

  const fileNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26)
  const extraLength = zipBuffer.readUInt16LE(localHeaderOffset + 28)
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength
  const compressedData = zipBuffer.subarray(dataStart, dataStart + compressedSize)

  if (compressionMethod === 0) return compressedData
  if (compressionMethod === 8) return inflateRawSync(compressedData)

  throw new Error(`不支持的 DOCX 压缩格式：${compressionMethod}`)
}

function findEndOfCentralDirectory(zipBuffer) {
  const minOffset = Math.max(0, zipBuffer.length - 0xffff - 22)

  for (let cursor = zipBuffer.length - 22; cursor >= minOffset; cursor -= 1) {
    if (zipBuffer.readUInt32LE(cursor) === 0x06054b50) {
      return cursor
    }
  }

  throw new Error('DOCX 文件目录尾部不存在。')
}

function normalizeDocxText(xml) {
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function resolveModel(modelProfile) {
  if (modelProfile === 'fast') {
    return process.env.JUDGE_LLM_FAST_MODEL ?? process.env.JUDGE_LLM_MODEL ?? 'qwen-turbo'
  }

  return process.env.JUDGE_LLM_MODEL ?? 'qwen-max'
}

function normalizeMaxTokens(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return MAX_MODEL_OUTPUT_TOKENS
  return Math.min(Math.floor(parsed), MAX_MODEL_OUTPUT_TOKENS)
}

function parseModelContent(content, responseMode = 'json') {
  if (typeof content !== 'string') {
    throw new Error('Cloud model returned empty content')
  }

  const trimmed = content.trim()
  if (responseMode === 'text') {
    return { content: trimmed }
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const jsonText = fencedMatch?.[1] ?? trimmed

  try {
    return JSON.parse(jsonText)
  } catch {
    return {
      source_boundary: '模型返回内容未能解析为结构化 JSON，以下保留原始文本供检查。',
      markdown: trimmed,
      uncertainties: ['**模型输出格式异常**：需要重试、调低温度，或强化 JSON 输出约束。'],
    }
  }
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let receivedBytes = 0
    let rawBody = ''

    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      receivedBytes += Buffer.byteLength(chunk)
      if (receivedBytes > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large'))
        request.destroy()
        return
      }

      rawBody += chunk
    })
    request.on('end', () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    request.on('error', reject)
  })
}

function readRawBody(request) {
  return new Promise((resolve, reject) => {
    let receivedBytes = 0
    const chunks = []

    request.on('data', (chunk) => {
      receivedBytes += chunk.length
      if (receivedBytes > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large'))
        request.destroy()
        return
      }

      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name')

  if (statusCode === 204) {
    response.end()
    return
  }

  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function loadEnvFile(filePath) {
  let content

  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = unquoteEnvValue(trimmed.slice(separatorIndex + 1).trim())
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function stripTrailingSlash(value) {
  return String(value).replace(/\/+$/, '')
}
