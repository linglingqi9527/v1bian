import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { GENERATED_DIR } from './selectSpeakerTargets.js'
import {
  getQualificationRosterPath,
  normalizeTeamName,
} from './teamRoster.js'
import {
  determineYear,
  isQualificationScopeMatch,
} from './qualificationScope.js'

const MATCHES_PATH = path.join(GENERATED_DIR, 'generatedMatches.json')
const ROSTER_INDEX_PATH = path.join(GENERATED_DIR, 'rosterIndex.2024.qualification.json')
const ROSTER_REPORT_PATH = path.join(GENERATED_DIR, 'rosterDataReport.2024.qualification.json')
const YEAR = 2024
const COMPETITION_TYPE = '资格赛'
const ONLINE_SEGMENT = '线上赛段'
const OFFLINE_SEGMENT = '线下赛段'
const COVERAGE_BY_SCHOOL = 'school-combined'
const COVERAGE_MISSING = 'partial-or-missing'

export async function buildRoster2024QualificationReport() {
  const [byStageRows, combinedRows, matches] = await Promise.all([
    readJson(getQualificationRosterPath({ year: YEAR, mode: 'byStage' })),
    readJson(getQualificationRosterPath({ year: YEAR, mode: 'combined' })),
    readJson(MATCHES_PATH),
  ])
  const cleanByStageRows = normalizeRows(byStageRows)
  const cleanCombinedRows = normalizeRows(combinedRows)
  const rosterIndex = createRosterIndex(cleanByStageRows, cleanCombinedRows)
  const report = createReport({
    byStageRows: cleanByStageRows,
    combinedRows: cleanCombinedRows,
    matches,
    rosterIndex,
  })

  await mkdir(GENERATED_DIR, { recursive: true })
  await Promise.all([
    writeJson(ROSTER_INDEX_PATH, rosterIndex),
    writeJson(ROSTER_REPORT_PATH, report),
  ])
  return { report, rosterIndex }
}

function normalizeRows(rows) {
  return rows
    .filter((row) => Number(row.year) === YEAR && row.competitionType === COMPETITION_TYPE)
    .map((row) => ({
      ...row,
      name: String(row.name ?? '').trim(),
      team: String(row.team ?? '').trim(),
    }))
    .filter((row) => row.name && row.team)
}

function createRosterIndex(byStageRows, combinedRows) {
  const teamNames = [...new Set([
    ...byStageRows.map((row) => row.team),
    ...combinedRows.map((row) => row.team),
  ])].sort((left, right) => left.localeCompare(right, 'zh-CN'))

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    year: YEAR,
    competitionType: COMPETITION_TYPE,
    source: {
      byStage: 'scripts/crawler/bilibili/speakerEnrichment/rosters/team_roster_2024_qualification_by_stage.json',
      combinedBySchool: 'scripts/crawler/bilibili/speakerEnrichment/rosters/team_roster_2024_qualification_combined_by_school.json',
    },
    policy: {
      primary: '2024 资格赛识别先按学校使用 combinedBySchool 合并名单，同一学校线上/线下名单统一纳入候选池。',
      referenceOnly: 'byStage 仅作为来源记录和后续人工追溯依据，不作为当前自动识别的筛选条件。',
    },
    teams: teamNames.map((team) => createTeamIndex(team, byStageRows, combinedRows)),
  }
}

function createTeamIndex(team, byStageRows, combinedRows) {
  const byStage = [ONLINE_SEGMENT, OFFLINE_SEGMENT]
    .map((stageSegment) => {
      const rows = byStageRows.filter((row) => row.team === team && row.stageSegment === stageSegment)
      return {
        sourceImages: unique(rows.map((row) => row.sourceImage).filter(Boolean)),
        speakers: unique(rows.map((row) => row.name)),
        stageSegment,
        teamCodes: unique(rows.map((row) => row.teamCode).filter(Boolean)),
      }
    })
    .filter((stage) => stage.speakers.length > 0)
  const combined = combinedRows.filter((row) => row.team === team)

  return {
    team,
    combinedSpeakers: unique(combined.map((row) => row.name)),
    hasDifferentStageRosters: hasDifferentStageRosters(byStage),
    stageRosters: byStage,
  }
}

function hasDifferentStageRosters(stageRosters) {
  if (stageRosters.length <= 1) return false
  const [first, ...rest] = stageRosters.map((stage) => stage.speakers)
  return rest.some((speakers) => !sameStringSet(first, speakers))
}

function createReport({
  byStageRows,
  combinedRows,
  matches,
  rosterIndex,
}) {
  const matches2024 = matches.filter((match) => determineYear(match) === YEAR)
  const qualificationMatches = matches2024.filter(isQualificationLikeMatch)
  const matchCoverage = qualificationMatches.map((match) => createMatchCoverage(match, rosterIndex))
  const teamsWithDifferentStageRosters = rosterIndex.teams.filter((team) => team.hasDifferentStageRosters)

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    year: YEAR,
    competitionType: COMPETITION_TYPE,
    roster: {
      byStageRows: byStageRows.length,
      byStageSchools: unique(byStageRows.map((row) => row.team)).length,
      combinedRows: combinedRows.length,
      combinedSchools: unique(combinedRows.map((row) => row.team)).length,
      stageSegments: countBy(byStageRows, (row) => row.stageSegment),
      schoolsWithDifferentStageRosters: teamsWithDifferentStageRosters.length,
      differentStageRosterTeams: teamsWithDifferentStageRosters.map((team) => ({
        team: team.team,
        stageCounts: team.stageRosters.map((stage) => ({
          count: stage.speakers.length,
          stageSegment: stage.stageSegment,
        })),
      })),
    },
    matches: {
      generated2024Count: matches2024.length,
      qualificationLikeCount: qualificationMatches.length,
      bothTeamsCoveredBySchoolCount: matchCoverage.filter((item) => item.coverage === COVERAGE_BY_SCHOOL).length,
      partialOrMissingRosterCount: matchCoverage.filter((item) => item.coverage === COVERAGE_MISSING).length,
      coverage: matchCoverage,
    },
    notes: [
      '本报告只整理 2024 资格赛名单与现有比赛卡片的覆盖关系，不写入 generatedMatches.json。',
      '当前策略按学校使用合并名单：同一学校线上/线下辩手全部纳入同一个识别库，有匹配就进入候选。',
      'byStage 版本保留为来源追溯，不参与当前覆盖判断。',
    ],
  }
}

function createMatchCoverage(match, rosterIndex) {
  const teams = (match.teams ?? []).map((matchTeam) => {
    const rosterTeam = findTeamIndex(matchTeam, rosterIndex.teams)
    return {
      combinedSpeakerCount: rosterTeam?.combinedSpeakers.length ?? 0,
      hasDifferentStageRosters: Boolean(rosterTeam?.hasDifferentStageRosters),
      matchTeam,
      rosterTeam: rosterTeam?.team ?? '',
    }
  })
  const combinedCovered = teams.length === 2
    && teams.every((team) => team.combinedSpeakerCount > 0)
  return {
    bilibiliUrl: match.bilibiliUrl,
    bvId: match.bvId,
    coverage: combinedCovered ? COVERAGE_BY_SCHOOL : COVERAGE_MISSING,
    date: match.date,
    id: match.id,
    stage: match.stage,
    teams,
    title: match.title,
  }
}

function findTeamIndex(matchTeam, teamIndexes) {
  const normalizedMatchTeam = normalizeTeamName(matchTeam)
  return teamIndexes.find((team) => {
    const normalizedRosterTeam = normalizeTeamName(team.team)
    return normalizedMatchTeam === normalizedRosterTeam
      || normalizedMatchTeam.includes(normalizedRosterTeam)
      || normalizedRosterTeam.includes(normalizedMatchTeam)
  })
}

function isQualificationLikeMatch(match) {
  return isQualificationScopeMatch(match, { year: YEAR })
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item) || 'unknown'
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
}

function sameStringSet(left, right) {
  const leftSet = new Set(left)
  const rightSet = new Set(right)
  return leftSet.size === rightSet.size
    && [...leftSet].every((item) => rightSet.has(item))
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function runCli() {
  const { report } = await buildRoster2024QualificationReport()
  console.log(
    `[speakers:roster:2024:report] ${report.roster.byStageRows} 条分赛段名单，`
    + `${report.roster.combinedRows} 条合并名单。`,
  )
  console.log(
    `[speakers:roster:2024:report] ${report.matches.qualificationLikeCount} 场 2024 比赛进入覆盖检查。`,
  )
  console.log(`[speakers:roster:2024:report] ${path.relative(process.cwd(), ROSTER_REPORT_PATH)}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(`[speakers:roster:2024:report] ${error?.message ?? error}`)
    process.exitCode = 1
  })
}
