import { createReviewModel } from '../models/reviewModel.js'
import { DEMO_USER_ID } from '../models/userModel.js'

export const demoReviews = [
  createReviewModel({
    id: 'review-001',
    userId: DEMO_USER_ID,
    matchId: 'match-001',
    title: '新生杯半决赛示例 赛评',
    content: '这场比赛的关键在于双方对“主体性”的定义是否稳定，以及攻防是否围绕核心比较展开。',
    updatedAt: '2026-06-10T12:00:00.000Z',
  }),
]
