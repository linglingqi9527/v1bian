import { demoMatches } from '../../data/demoMatches.js'
import { DEMO_USER_ID } from '../../models/userModel.js'

export function listMatches() {
  return demoMatches.filter((match) => match.userId === DEMO_USER_ID)
}

export function getMatchById(matchId) {
  return listMatches().find((match) => match.id === matchId)
}
