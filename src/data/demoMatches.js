import { createMatchModel } from '../models/matchModel.js'
import { DEMO_USER_ID } from '../models/userModel.js'

export const demoMatches = [
  createMatchModel({
    id: 'match-001',
    userId: DEMO_USER_ID,
    title: '新生杯半决赛示例',
    topic: '技术进步是否会削弱人的主体性',
    summary: '用于验证看比赛到赛评再到训练的本地流程。',
    status: '已看',
    publishedAt: '2026-06-01T10:00:00.000Z',
  }),
  createMatchModel({
    id: 'match-002',
    userId: DEMO_USER_ID,
    title: '校际邀请赛示例',
    topic: '公共讨论更需要共识还是分歧',
    summary: '保留为未看比赛示例。',
    status: '未看',
    publishedAt: '2026-06-08T10:00:00.000Z',
  }),
]
