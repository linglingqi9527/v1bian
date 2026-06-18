import { create } from 'zustand'
import { seedData } from '../data/seedData.js'
import { createUserModel } from '../models/userModel.js'

export const useAppStore = create(() => ({
  user: createUserModel(),
  matches: seedData.matches,
  reviews: seedData.reviews,
  trainings: seedData.trainings,
}))
