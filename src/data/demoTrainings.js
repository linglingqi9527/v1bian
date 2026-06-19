import { createTrainingModel } from '../models/trainingModel.js'
import { DEMO_USER_ID } from '../models/userModel.js'

export const demoTrainings = [
  createTrainingModel({
    id: 'training-001',
    userId: DEMO_USER_ID,
    matchId: 'match-001',
    reviewId: 'review-001',
    title: '主体性定义攻防复述训练',
    mode: 'audio',
    note: '训练备注只评价自己的表达、节奏和攻防反应。',
    createdAt: '2026-06-11T12:00:00.000Z',
  }),
  createTrainingModel({
    id: 'training-002',
    userId: DEMO_USER_ID,
    matchId: 'match-001',
    reviewId: 'review-001',
    title: '创作者意义定义训练',
    mode: 'audio',
    note: '训练备注用于记录自己的表达调整，不写入赛评正文。',
    createdAt: '2026-06-12T12:00:00.000Z',
  }),
  createTrainingModel({
    id: 'training-003',
    userId: DEMO_USER_ID,
    matchId: 'match-001',
    reviewId: 'review-001',
    title: '反方比较标准复述训练',
    mode: 'video',
    note: '训练备注和赛评分离。',
    createdAt: '2026-06-13T12:00:00.000Z',
  }),
]
