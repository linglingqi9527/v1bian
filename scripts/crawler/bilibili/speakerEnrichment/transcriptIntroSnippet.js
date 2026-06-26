const INTRO_MAX_CHARS = 3000

export function extractIntroSnippetText(transcriptText = '', {
  maxChars = INTRO_MAX_CHARS,
} = {}) {
  const text = normalizeTranscriptForIntro(transcriptText)
  const endMatch = /在\s*认识了?\s*双方\s*辩手\s*之后|比赛.{0,4}正[式是]\s*开始|首先.{0,8}[陈臣陳][词茨司茲]/.exec(text)
  const endIndex = endMatch?.index ?? Math.min(text.length, maxChars)
  return text.slice(0, endIndex).trim()
}

export function normalizeTranscriptForIntro(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\u00a0]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[雙双]/g, '双')
    .replace(/[認认]識/g, '认识')
    .replace(/[辯辨變变]手/g, '辩手')
    .replace(/[一壹1]\s*[辩辯辨遍變变便]/g, '一辩')
    .replace(/[二贰兩两而2]\s*[辩辯辨遍變变便]/g, '二辩')
    .replace(/[三叁3]\s*[辩辯辨遍變变便]/g, '三辩')
    .replace(/[四肆4]\s*[辩辯辨遍變变便]/g, '四辩')
    .replace(/比賽/g, '比赛')
    .replace(/開始/g, '开始')
    .trim()
}

export function createIntroSnippetRecord({
  matched,
  target,
  transcript,
}) {
  const introText = extractIntroSnippetText(transcript.transcriptText)

  return {
    schemaVersion: 1,
    matchId: target.matchId,
    bvId: target.bvId,
    cid: target.cid ?? null,
    partIndex: target.partIndex,
    page: target.page,
    bilibiliUrl: target.bilibiliUrl,
    title: target.title,
    event: target.event,
    stage: target.stage,
    date: target.date,
    teams: target.teams,
    year: target.year,
    audioStart: transcript.audioStart,
    audioDuration: transcript.audioDuration,
    transcriptSource: transcript.transcriptSource,
    transcriptStatus: transcript.status,
    introText,
    introCharCount: introText.length,
    roleMarkerCount: matched.roleMarkerCount,
    warnings: [
      ...new Set([
        ...(transcript.warnings ?? []),
        ...(matched.warnings ?? []),
      ].filter(Boolean)),
    ],
    updatedAt: new Date().toISOString(),
  }
}
