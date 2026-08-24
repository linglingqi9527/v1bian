import { createJudgeReportSchemaSummary, getJudgeWordBudget } from './judgeReportSchema.js'

export function buildJudgePrompt({
  context,
  conversation,
  lengthMode = 'standard',
  userPrompt = '',
  sourceText = '',
} = {}) {
  const wordBudget = getJudgeWordBudget(lengthMode)

  return [
    '# JudgeAgent Task',
    '',
    '你是辩论赛评判 Agent。先建立事实底稿，再基于证据裁决；所有推断必须标注不确定性，所有判断必须回链到材料。',
    '',
    '## Context',
    JSON.stringify(createPromptContext(context, conversation), null, 2),
    '',
    '## User Request',
    userPrompt || '请基于当前材料生成 Judge 评判报告。',
    '',
    '## Source Text',
    sourceText || '当前未直接上传逐字稿，请优先使用传入的比赛/赛评/训练上下文。',
    '',
    '## Output Rules',
    [
      `length_mode: ${lengthMode}`,
      `target words: ${wordBudget.target}, min: ${wordBudget.min}, max: ${wordBudget.max}`,
      `本轮是首次生成评判报告，必须尽量写到 max ${wordBudget.max} 字附近；低于 min ${wordBudget.min} 视为不合格。不要因为删除选手复盘、补充素材库或风险章节而缩短总篇幅，省下来的字数必须分配给核心判准、主要论述与攻防、终局判决理由和最佳辩手。`,
      '开篇材料边界说明不设标题，控制在 60-120 字，只说明材料依据、角色标签处理方式和置信风险。',
      '如果 Source Text 已经包含完整或基本完整的辩论发言材料，必须给出比较性胜负判断，winner 只能是 affirmative 或 negative，win_margin 只能是 small/medium/big。不得在终局判断中写“暂不判胜负”“胜负幅度为材料不足”。',
      '不确定性只能放入 uncertainties 或相关段落的置信度，不能替代裁判结论。材料有瑕疵时应写“基于当前材料，谨慎判定为……”，而不是拒绝判断。',
      '公开报告中不要输出时间戳、页码式定位或 03:41/17:24/18:07 这类数字定位。如果需要说明依据，只写“正一指出……”“反四回应……”，引用中直接用辩手名字或角色。',
      '本场核心判准控制在 320-520 字：必须说明裁判到底在比较什么、双方各自证明责任、为什么这个判准会决定胜负。不要只罗列“法律要件/市场损害/公共利益”这类关键词，必须解释这些关键词如何成为裁判取舍标准。',
      '终局判断必须在报告前部直接给结论，控制在 360-560 字：说明谁赢、赢在哪几个关键点、胜负幅度为什么是这个等级。不要只写“正方胜/反方胜”，也不要只罗列双方观点。',
      '主要论述与攻防整理是主体，不得拆成很多短句，也不得写成表格式摘要。标准版输出 3-5 个论述模块；每个模块必须提供 analysis 字段，analysis 为 1000-1500 字的完整裁判分析，可分 2-4 个自然段。',
      'main_clashes 的 analysis 必须采用“主张 -> 理由 -> 对方攻击 -> 回应是否解决问题 -> 为什么裁判采信/不采信 -> 对胜负的影响”的逻辑链。每段都要回答“为什么这个论证有力/无力”，不能停在“某方提出了某观点”。',
      '删除字段式写法：不要在 analysis 中机械重复“正方主张/反方攻击/正方回应/裁判判断/残留问题”这些标签。也不要把多个观点并列堆放后直接说“因此占优”。',
      'main_clashes 的结构化字段 affirmative_claim/negative_attack/affirmative_response/judge_decision/remaining_issue 是可选辅助；如果填写，必须服务 analysis，不得替代 analysis。',
      '每个攻防模块至少写清一个“裁判采信链”：为什么该论点成立或不成立、它解决了判准中的哪一环、对方反驳为什么没有打穿或为什么打穿了、这会怎样改变胜负权重。',
      '终局判决理由必须给 3 条，每条 300-480 字；每条都要解释判准、机制、攻防结果之间的关系，不要写成一句结论，也不要重复列观点。',
      '主报告不生成逐个选手复盘，不展开每位辩手建议。speaker_feedback 必须返回空数组。用户若想看某位辩手复盘，将在后续追问中单独生成。',
      '必须新增 best_debater 字段：放在终局判决理由之后，说明本场最佳辩手是谁、属于哪一方、哪些连续表现决定了胜局；不要把重点写成“为什么 TA 比别人好”，而要叙事 TA 如何推动胜方赢下关键判准。',
      '主报告不生成独立的“补充素材库”和“不确定性与材料风险”章节。missing_materials 和 uncertainties 可以返回空数组；如确有关键风险，只能嵌入材料边界说明或相关攻防段落中，不得另开六、七章节。',
      'Markdown 只允许 # / ## / ### 三种标题层级。',
      'Markdown 章节只允许：# Judge 评判报告、## 一、本场核心判准、## 二、终局判断、## 三、主要论述与攻防整理、## 四、终局判决理由、## 五、本场最佳辩手。禁止生成“六、补充素材库”“七、不确定性与材料风险”或其他同级章节。',
      '胜负结论、胜负幅度、关键判断、最佳辩手、风险提示必须加粗，但不得整段加粗。',
      '禁止输出空泛套话，例如“表现不错”“需要加强逻辑”“论证更完整”“更有说服力”。如果说某方更有说服力，必须紧接着解释：因为它完成了哪项证明责任、化解了哪项攻击、或者让对方哪项主张无法进入判准。',
      '局部证据不足时，不要硬判该局部事实；必须写“该点材料不足，无法确认”，并降低置信度。不要因此放弃整场胜负判断。',
      '输出前自检：如果某段只是在列举双方观点，没有解释裁判为什么采信其中一方，必须重写该段；如果出现“占优/有力/完整/说服力强”等评价词，后面必须有至少一句原因分析。',
      '输出前自检：每个 main_clashes.analysis 至少包含两次对“证明责任、判准、攻防压力、胜负权重”中任意两个概念的连接解释，否则视为不合格。',
      `输出前自检：总篇幅必须接近 ${wordBudget.max} 字；如果明显偏短，优先扩写 main_clashes.analysis 的裁判采信链，其次扩写 final_reasons，不要新增章节凑字数。`,
      'JSON 字段必须完整。即使某字段无法确认，也要返回空数组、空字符串或“无法确认”，不要省略字段。',
      '必须输出可解析 JSON，不要在 JSON 外输出解释文本。',
    ].join('\n'),
    '',
    '## Required JSON Field Detail',
    JSON.stringify(createRequiredFieldDetail(), null, 2),
    '',
    '## JSON Schema Summary',
    JSON.stringify(createJudgeReportSchemaSummary(), null, 2),
  ].join('\n')
}

export function buildJudgeChatPrompt({
  conversation,
  sourceText = '',
  userPrompt = '',
} = {}) {
  const latestOutput = conversation?.outputs?.at(-1)
  const recentMessages = Array.isArray(conversation?.messages)
    ? conversation.messages.slice(-8).map((message) => ({
        role: message.role,
        content: message.content,
      }))
    : []

  return [
    '# JudgeAgent Follow-up Chat',
    '',
    '你是辩论赛复盘助手。用户已经有一份 Judge 评判报告，现在是在追问细节。请像正常聊天一样直接回答问题，不要重新生成完整报告，不要输出 JSON。',
    '',
    '## Answer Rules',
    [
      '回答必须围绕用户问题，不要从头复述整场比赛。',
      '如果用户问某个辩手、某个角色、某位选手的复盘/建议/表现，例如“正三怎么样”“反四有什么问题”“给某某建议”，必须进入选手复盘模式。',
      '选手复盘模式必须写清：这名辩手在本场主要做了什么；有哪些优势；这些优势为什么成立、如何影响攻防或判准；有哪些不足；这些不足为什么会影响胜负权重；下一场最应该改哪 1-3 个动作。',
      '选手复盘模式不要只写“表达好/逻辑强/需要更完整”这类空话。每个优点和问题后面都必须接原因：它贴住了哪条判准、制造了什么攻防压力、或漏掉了哪项证明责任。',
      '选手复盘模式要用自然语言分段回答，可以有短标题，但不要输出 JSON，不要机械列字段名。若材料不能确认姓名，按正一/反四/SPEAKER_00 等角色回答，并说明置信度。',
      '如果不是询问选手复盘，就正常回答用户问题，不套用选手复盘结构。',
      '如果用户问某个论点，就讲清逻辑链：主张 -> 理由 -> 对方攻击 -> 回应是否解决 -> 裁判为什么采信/不采信 -> 对胜负影响。',
      '不要机械列字段，不要输出时间戳。',
      '可以承认局部材料不足，但不能用“材料不足”替代分析；应说明基于现有报告/材料能判断到哪一步。',
      '回答长度按问题复杂度控制：简单追问 150-300 字；选手复盘或复杂攻防追问 600-1000 字。',
    ].join('\n'),
    '',
    '## User Question',
    userPrompt || '请继续解释。',
    '',
    '## Existing Judge Report',
    latestOutput?.markdown || latestOutput?.summary || '暂无已生成报告。',
    '',
    '## Recent Chat',
    JSON.stringify(recentMessages, null, 2),
    '',
    '## Source Text Excerpt',
    sourceText ? sourceText.slice(0, 18000) : '当前会话未保留完整原文；请优先依据已有报告回答。',
  ].join('\n')
}

function createRequiredFieldDetail() {
  return {
    source_boundary: '60-120 字，不设标题。说明只依据上传材料/上下文，角色标签如何处理，材料不足时降低判断强度。',
    core_standard: '320-520 字。回答本题比什么、双方证明责任、裁判采用什么标准、哪些误区不作为胜负依据。',
    final_judgment: '360-560 字。必须解释谁赢、赢在哪儿、为什么是该胜负幅度，并指出后文会展开的核心交锋。',
    main_clashes: [
      {
        title: '交锋主题，28 字以内',
        analysis: '1000-1500 字。完整裁判分析，可以分 2-4 个自然段；必须按“主张 -> 理由 -> 攻击 -> 回应 -> 裁判采信原因 -> 胜负影响”写清逻辑链。不要写成字段式短句。',
        affirmative_claim: '可选内部摘要，不要替代 analysis',
        negative_attack: '可选内部摘要，不要替代 analysis',
        affirmative_response: '可选内部摘要，不要替代 analysis',
        judge_decision: '可选内部摘要；若填写，必须解释谁占优以及为什么',
        remaining_issue: '可选内部摘要；只记录 analysis 中已经解释过的残留问题',
        evidence_refs: [
          {
            speaker: '发言者/角色',
            time: '内部可留空；公开报告不要显示时间戳',
            quote: '短摘录，不超过 40 字',
          },
        ],
      },
    ],
    final_reasons: [
      {
        title: '理由标题',
        content: '300-480 字，说明该理由如何从判准推导到胜负。',
        evidence_refs: [],
      },
    ],
    speaker_feedback: '主报告固定返回空数组。逐个选手复盘由后续追问生成。',
    best_debater: {
      speaker: '最佳辩手；无法确认时写“无法确认”',
      side: '正方/反方/无法确认',
      key_contribution: 'TA 对胜负或比赛质量的关键贡献。',
      reason: '280-460 字，以比赛进程为线索叙述 TA 如何通过若干关键表现决定胜局。不要写成与其他辩手的横向比较。',
      evidence_refs: [],
      confidence: '[低置信]/[中置信]/[高置信]',
    },
  }
}

function createPromptContext(context, conversation) {
  return {
    conversation_id: conversation?.id ?? '',
    conversation_title: conversation?.title ?? '',
    context_type: context?.type ?? conversation?.contextType ?? '',
    source_label: context?.sourceLabel ?? conversation?.sourceLabel ?? '',
    match: context?.match ? {
      id: context.match.id,
      topic: context.match.topic,
      affirmative: context.match.affirmative,
      negative: context.match.negative,
      videoUrl: context.match.videoUrl || context.match.bilibiliUrl || context.match.sourceUrl || '',
      speakerGroups: context.match.speakerGroups,
    } : null,
    review: context?.review ? {
      id: context.review.id,
      title: context.review.title,
      status: context.review.status,
    } : null,
    training: context?.training ? {
      id: context.training.id,
      title: context.training.title,
      mode: context.training.mode,
    } : null,
    available_materials: context?.availableMaterials ?? [],
  }
}
