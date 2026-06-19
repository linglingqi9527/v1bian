import { createMatchModel } from '../../models/matchModel.js'

export function normalizeMatchData(rawMatch) {
  return createMatchModel({
    id: rawMatch.id,
    title: rawMatch.title,
    event: rawMatch.event,
    stage: rawMatch.stage,
    date: rawMatch.date,
    bvId: rawMatch.bvId,
    bilibiliUrl: rawMatch.bilibiliUrl ?? rawMatch.sourceUrl,
    teams: rawMatch.teams,
    speakers: rawMatch.speakers,
    favorite: rawMatch.favorite,
    watched: rawMatch.watched,
    reviewId: rawMatch.reviewId,
    trainingIds: rawMatch.trainingIds,
    publishedAt: rawMatch.publishedAt,
  })
}
