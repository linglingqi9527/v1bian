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
]
