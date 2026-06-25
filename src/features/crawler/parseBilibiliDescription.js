export function parseBilibiliDescription(description = '', title = '') {
  const rawDescription = String(description ?? '')
  const videoTitle = decodeHtmlEntities(String(title ?? '')).trim()
  const text = normalizeText(rawDescription)
  const corpus = `${videoTitle}\n${text}`
  const pipeInfo = parseTopicFirstPipeTitle(videoTitle)
  const namedMatchupInfo = parseNamedMatchupTitle(videoTitle)
  const multipartInfo = namedMatchupInfo.topic
    ? namedMatchupInfo
    : pipeInfo.topic
      ? parseMatchupContext(pipeInfo.context)
      : parseMultipartTitle(videoTitle)
  const event = pickField(text, ['赛事名称', '赛事', '比赛名称', '比赛']) || findEvent(corpus)
  const stage = cleanStage(
    pickField(text, ['赛段', '阶段', '场次', '组别']) || multipartInfo.stage || findStageLine(text, event) || findStage(corpus),
    event,
  )
  const labeledTopic = pickField(text, ['辩题', '题目'])
  const debateTopic = labeledTopic || pipeInfo.topic || multipartInfo.topic || findUnlabeledTopic(text, event, stage) || inferTopicFromTitle(videoTitle, event, stage)
  const teams = multipartInfo.teams.length >= 2 ? multipartInfo.teams : findTeams(text, videoTitle)
  const speakers = findSpeakers(text)
  const parseWarnings = []

  if (!labeledTopic && !pipeInfo.topic && !multipartInfo.topic && !findUnlabeledTopic(text, event, stage)) {
    parseWarnings.push('未找到明确的辩题字段，已使用清理后的视频标题。')
  }
  if (!event) parseWarnings.push('未能确定赛事名称。')
  if (!stage) parseWarnings.push('未能确定赛段。')
  if (teams.length < 2) parseWarnings.push('未能确定完整的双方学校或队伍。')
  if (speakers.length === 0) parseWarnings.push('未能解析辩手名单。')

  return {
    debateTopic: debateTopic || videoTitle,
    title: debateTopic || videoTitle,
    event,
    stage,
    teams,
    speakers,
    rawDescription,
    parseWarnings,
  }
}

function parseMatchupContext(context) {
  const versusMatch = context.match(/^(.*?)\s*(?:vs\.?|VS|对阵)\s*(.+)$/i)
  if (!versusMatch) return { stage: '', teams: [], topic: '' }
  const leftParts = versusMatch[1].trim().split(/\s+/)
  if (leftParts.length < 2) return { stage: '', teams: [], topic: '' }
  const firstTeam = cleanTeam(leftParts.pop())
  const secondTeam = cleanTeam(versusMatch[2])
  return {
    stage: leftParts.join(' ').trim(),
    teams: [firstTeam, secondTeam].filter(Boolean),
    topic: '',
  }
}

function parseTopicFirstPipeTitle(title) {
  const [topic, ...contextParts] = title.split(/[丨|｜]/)
  const context = contextParts.join(' ').trim()
  const hasDebateChoice = topic.includes('/')
    || topic.includes('／')
    || /还是|应不应该|有利于|不利于/.test(topic)
  if (!context || !hasDebateChoice) {
    return { context: '', topic: '' }
  }
  return { context, topic: topic.trim() }
}

function parseNamedMatchupTitle(title) {
  const match = title.match(/^(.*?)\s*[丨|｜]\s*(.+?)\s*(?:vs\.?|VS)\s*(.+?)\s*[:：]\s*(.+)$/i)
  if (!match) return { stage: '', teams: [], topic: '' }
  return {
    stage: match[1].trim(),
    teams: [cleanTeam(match[2]), cleanTeam(match[3])].filter(Boolean),
    topic: match[4].trim(),
  }
}

function parseMultipartTitle(title) {
  const versusMatch = title.match(/^(.*?)\s*(?:vs\.?|VS|对阵)\s*(.*)$/i)
  if (!versusMatch) return { stage: '', teams: [], topic: '' }

  const leftParts = versusMatch[1].trim().split(/\s+/)
  if (leftParts.length < 2) return { stage: '', teams: [], topic: '' }

  const firstTeam = cleanTeam(leftParts.pop())
  const rightMatch = versusMatch[2].trim().match(/^(\S+?)\s+(.+)$/)
  if (!firstTeam || !rightMatch) return { stage: '', teams: [], topic: '' }

  const secondTeam = cleanTeam(rightMatch[1])
  const topic = rightMatch[2].trim()
  if (!secondTeam || !topic) return { stage: '', teams: [], topic: '' }

  return {
    stage: leftParts.join(' ').trim(),
    teams: [firstTeam, secondTeam],
    topic,
  }
}

function pickField(text, labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`(?:^|\\n)\\s*${escapeRegExp(label)}\\s*[:：]\\s*([^\\n]+)`, 'i'))
    if (match?.[1]) return match[1].trim()
  }

  return null
}

function findEvent(text) {
  return text.match(/20\d{2}\s*(?:bilibili\s*)?新国辩|20\d{2}\s*国际华语辩论邀请赛|新国辩/i)?.[0]
    ?.replace(/\s+/g, '') ?? ''
}

function findStage(text) {
  return text.match(
    /(?:高校组|国际组|大学组|中学组)?\s*(?:(?:初赛|复赛|半决赛|决赛|小组赛|淘汰赛|循环赛|资格赛)(?:\s*[A-Za-z0-9一二三四五六七八九十]+组)?(?:\s*第[一二三四五六七八九十百\d]+(?:场|轮))?|哲理辩论(?:\d+(?:\.\d+)?[ⅠⅡⅢⅣV]*)?|[^丨|｜\n]{0,12}表演赛)/i,
  )?.[0]?.replace(/\s+/g, ' ').trim() ?? ''
}

function cleanStage(value, event) {
  return String(value ?? '')
    .replace(event, '')
    .replace(/^(?:20)?(?:23|24|25|26)(?:bilibili)?新国辩\s*[·:：]?\s*/i, '')
    .replace(/^第[一二三四五六七八九十\d]+届新国辩\s*[·:：]?\s*/, '')
    .replace(/^[\s·|｜:：—_-]+/, '')
    .trim()
}

function findStageLine(text, event) {
  const line = text.split('\n').find((item) => (
    /新国辩/.test(item) && /初赛|复赛|半决赛|决赛|资格赛|小组赛|淘汰赛|循环赛/.test(item)
  ))
  if (!line) return ''
  return line
    .replace(event, '')
    .replace(/^[\s·|｜:：—_-]+/, '')
    .trim()
}

function findUnlabeledTopic(text, event, stage) {
  return text.split('\n').find((line) => {
    if (!line || line === event || line === stage) return false
    if (/^(?:正方|反方|持方|辩手|评审|赛果|环节)\s*[:：]/.test(line)) return false
    if (/新国辩/.test(line) && /初赛|复赛|半决赛|决赛|资格赛/.test(line)) return false
    return line.length >= 6 && line.length <= 120 && /\/|／|还是|应不应该|有利于|不利于|是|不是/.test(line)
  }) ?? ''
}

function inferTopicFromTitle(title, event, stage) {
  let topic = title
    .replace(/^【[^】]+】\s*/, '')
    .replace(/^\[[^\]]+\]\s*/, '')

  for (const fragment of [event, stage]) {
    if (fragment) topic = topic.replace(fragment, ' ')
  }

  topic = topic
    .replace(/20\d{2}\s*(?:bilibili\s*)?新国辩/gi, ' ')
    .replace(/^第[一二三四五六七八九十\d]+届新国辩\s*[·:：]?\s*/, '')
    .replace(/^[\s|｜:：·•—_-]+|[\s|｜:：·•—_-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return topic || title
}

function findTeams(text, title) {
  const teams = []
  const directMatch = pickField(text, ['对阵', '双方学校', '学校', '队伍'])
  if (directMatch) teams.push(...splitTeams(directMatch))

  for (const side of ['正方学校', '正方队伍', '正方', '反方学校', '反方队伍', '反方']) {
    const value = pickField(text, [side])
    if (value) teams.push(cleanTeam(value))
  }

  const versusPattern = /([\p{Script=Han}A-Za-z0-9·（）()]{2,30}(?:大学|学院|中学|学校|代表队|队))\s*(?:vs\.?|VS|对阵|对)\s*([\p{Script=Han}A-Za-z0-9·（）()]{2,30}(?:大学|学院|中学|学校|代表队|队))/gu
  const versusMatch = versusPattern.exec(`${title}\n${text}`)
  if (versusMatch) teams.push(cleanTeam(versusMatch[1]), cleanTeam(versusMatch[2]))

  return unique(teams.filter(Boolean)).slice(0, 2)
}

function findSpeakers(text) {
  const speakers = []
  const rolePattern = /(?:正方|反方)?\s*(?:一|二|三|四|1|2|3|4)\s*辩(?:手)?\s*[:：]\s*([\p{Script=Han}A-Za-z·]{2,20})/gu

  for (const match of text.matchAll(rolePattern)) speakers.push(cleanPerson(match[1]))

  for (const label of ['辩手', '选手', '队员', '正方辩手', '反方辩手']) {
    for (const value of pickFields(text, label)) speakers.push(...splitPeople(value))
  }

  for (const label of ['正方', '反方']) {
    for (const value of pickSectionValues(text, label)) speakers.push(...splitPeople(value))
  }

  return unique(speakers.filter(Boolean))
}

function splitTeams(value) {
  return value
    .split(/\s*(?:vs\.?|VS|对阵)\s*|\s+对\s+|[、,，/|｜;；]/)
    .map(cleanTeam)
    .filter(Boolean)
    .slice(0, 2)
}

function splitPeople(value) {
  return value
    .replace(/(?:正方|反方)?\s*(?:一|二|三|四|1|2|3|4)\s*辩(?:手)?\s*[:：]?/gu, ' ')
    .split(/[、,，/|｜;；\s]+/)
    .map(cleanPerson)
    .filter(Boolean)
}

function cleanTeam(value) {
  return String(value)
    .replace(/^(?:正方|反方|学校|队伍)\s*[:：]?\s*/, '')
    .replace(/^[A-Za-z]+\d+\s*/, '')
    .replace(/^[A-Z]{1,4}(?=[\p{Script=Han}])/u, '')
    .replace(/[（(].*?[）)]/g, '')
    .trim()
}

function pickFields(text, label) {
  const pattern = new RegExp(`(?:^|\\n)\\s*${escapeRegExp(label)}\\s*[:：]\\s*([^\\n]+)`, 'gi')
  return [...text.matchAll(pattern)].map((match) => match[1].trim()).filter(Boolean)
}

function pickSectionValues(text, label) {
  const pattern = new RegExp(
    `(?:^|\\n)\\s*${escapeRegExp(label)}\\s*[:：]\\s*(?:\\n\\s*)?([^\\n]+)`,
    'gi',
  )
  return [...text.matchAll(pattern)].map((match) => match[1].trim()).filter(Boolean)
}

function cleanPerson(value) {
  const person = String(value)
    .replace(/^@/, '')
    .replace(/[：:，,。；;|｜/]/g, '')
    .trim()
  if (!/^[\p{Script=Han}A-Za-z\d_·-]{2,30}$/u.test(person)) return ''
  if (/(大学|学院|中学|学校|书院|代表队|辩论队|辩手|选手|队员)$/.test(person)) return ''
  return person
}

function normalizeText(value) {
  return decodeHtmlEntities(String(value))
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\t]+/g, ' ')
    .split('\n')
    .map((line) => line.replace(/^\s*[•·▪◆◇▶▷*-]\s*/, '').trim())
    .filter(Boolean)
    .join('\n')
}

function decodeHtmlEntities(value) {
  const namedEntities = {
    '&amp;': '&',
    '&gt;': '>',
    '&lt;': '<',
    '&nbsp;': ' ',
    '&quot;': '"',
    '&#39;': "'",
  }

  return value
    .replace(/&(amp|gt|lt|nbsp|quot);|&#39;/gi, (entity) => namedEntities[entity.toLowerCase()] ?? entity)
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([\da-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
}

function unique(values) {
  return [...new Set(values)]
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
