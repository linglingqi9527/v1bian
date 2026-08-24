export async function transcribeJudgeVideo({
  bvId = '',
  matchId = '',
  speakerGroups = [],
  title = '',
  videoUrl = '',
} = {}) {
  const endpoint = String(import.meta.env.VITE_JUDGE_TRANSCRIPT_ENDPOINT ?? '/api/judge-agent/transcribe-video').trim()

  if (!endpoint) {
    throw new Error('视频转文字接口未配置。')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bvId,
      matchId,
      speakerGroups,
      title,
      videoUrl,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `视频转文字失败：${response.status}`)
  }

  const text = typeof data.text === 'string' ? data.text.trim() : ''
  if (!text) {
    throw new Error('视频转文字没有返回有效正文。')
  }

  return {
    provider: data.provider ?? 'transcript-proxy',
    text,
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  }
}
