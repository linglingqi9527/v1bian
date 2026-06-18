import { normalizeMatchData } from './normalizeMatchData.js'

export function importMatchesFromJson(records) {
  if (!Array.isArray(records)) {
    throw new Error('Match import payload must be an array')
  }

  return records.map(normalizeMatchData)
}
