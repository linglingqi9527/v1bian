import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mergeRosterSpeakerResults } from './mergeRosterSpeakerResults.js'
import { GENERATED_DIR } from './selectSpeakerTargets.js'

const YEAR = 2024
const SCOPE = 'janMain'
const CANDIDATES_PATH = path.join(
  GENERATED_DIR,
  `rosterSpeakerCandidates.${YEAR}.${SCOPE}.json`,
)

async function mergeRoster2024JanMainResults() {
  const records = JSON.parse(await readFile(CANDIDATES_PATH, 'utf8'))
  return mergeRosterSpeakerResults(records, {
    acceptLowConfidence: true,
    replaceSpeakers: true,
    source: 'openingAudioRosterJanMainAcceptedCandidates',
    writeSpeakerGroups: true,
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mergeRoster2024JanMainResults()
    .then((result) => {
      console.log(
        '[speakers:roster:2024:jan-main:merge] '
        + `已合并 ${result.mergedMatchCount} 场，新增 ${result.mergedSpeakerCount} 名辩手。`,
      )
    })
    .catch((error) => {
      console.error(`[speakers:roster:2024:jan-main:merge] ${error?.message ?? error}`)
      process.exitCode = 1
    })
}
