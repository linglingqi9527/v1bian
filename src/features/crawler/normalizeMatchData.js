import { createMatchModel } from '../../models/matchModel.js'

export function normalizeMatchData(rawMatch) {
  return createMatchModel({
    id: rawMatch.id,
    title: rawMatch.title,
    topic: rawMatch.topic,
    sourceUrl: rawMatch.sourceUrl,
    publishedAt: rawMatch.publishedAt,
  })
}
