import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const QUALIFICATION_ROSTER_PATH = fileURLToPath(
  new URL('./rosters/team_roster_2025_qualification.json', import.meta.url),
)

export const QUALIFICATION_ROSTER_2025_VERIFIED_PATH = fileURLToPath(
  new URL('./rosters/team_roster_2025_verified.json', import.meta.url),
)

export const QUALIFICATION_ROSTER_2024_BY_STAGE_PATH = fileURLToPath(
  new URL('./rosters/team_roster_2024_qualification_by_stage.json', import.meta.url),
)

export const QUALIFICATION_ROSTER_2024_COMBINED_PATH = fileURLToPath(
  new URL('./rosters/team_roster_2024_qualification_combined_by_school.json', import.meta.url),
)

export const QUALIFICATION_ROSTER_2024_VERIFIED_COMBINED_PATH = fileURLToPath(
  new URL('./rosters/team_roster_2024_verified_combined_by_school.json', import.meta.url),
)

export function getQualificationRosterPath({
  mode = 'byStage',
  year = 2025,
} = {}) {
  if (year === 2025 && mode === 'verified') return QUALIFICATION_ROSTER_2025_VERIFIED_PATH
  if (year === 2024 && mode === 'verifiedCombined') {
    return QUALIFICATION_ROSTER_2024_VERIFIED_COMBINED_PATH
  }
  if (year === 2024 && mode === 'combined') return QUALIFICATION_ROSTER_2024_COMBINED_PATH
  if (year === 2024) return QUALIFICATION_ROSTER_2024_BY_STAGE_PATH
  return QUALIFICATION_ROSTER_PATH
}

export async function loadTeamRoster({
  competitionType = '资格赛',
  year = 2025,
  mode = year === 2024 ? 'verifiedCombined' : 'verified',
  rosterPath = getQualificationRosterPath({ mode, year }),
  stageSegment,
} = {}) {
  const rows = JSON.parse(await readFile(rosterPath, 'utf8'))
  return rows.filter((row) => (
    Number(row.year) === year && row.competitionType === competitionType
  )).filter((row) => !stageSegment || row.stageSegment === stageSegment)
}

export function resolveTargetRoster(target, rosterRows) {
  const rosterTeams = [...new Set(rosterRows.map((row) => row.team))]
  const teams = (target.teams ?? []).map((matchTeam) => {
    const rosterTeam = rosterTeams.find((candidate) => teamsMatch(matchTeam, candidate)) ?? ''
    const members = rosterTeam
      ? rosterRows.filter((row) => row.team === rosterTeam).map((row) => row.name)
      : []
    return {
      matchTeam,
      members,
      rosterTeam,
    }
  })
  const warnings = []
  if (teams.length !== 2) warnings.push('比赛数据未提供完整的双方队伍。')
  for (const team of teams) {
    if (!team.rosterTeam) warnings.push(`名单库中找不到队伍：${team.matchTeam}`)
    if (team.rosterTeam && team.members.length === 0) warnings.push(`队伍没有报名人员：${team.rosterTeam}`)
  }
  return {
    competitionType: '资格赛',
    covered: teams.length === 2 && teams.every((team) => team.members.length > 0),
    prompt: buildRosterPrompt(teams),
    teams,
    warnings,
    year: target.year,
  }
}

export function normalizeTeamName(value) {
  return String(value ?? '')
    .replace(/臺/g, '台')
    .replace(/灣/g, '湾')
    .replace(/學/g, '学')
    .replace(/師/g, '师')
    .replace(/範/g, '范')
    .replace(/門/g, '门')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, '')
    .replace(/代表队|辩论队/g, '')
}

function teamsMatch(left, right) {
  const normalizedLeft = normalizeTeamName(left)
  const normalizedRight = normalizeTeamName(right)
  return normalizedLeft === normalizedRight
    || normalizedLeft.includes(normalizedRight)
    || normalizedRight.includes(normalizedLeft)
}

function buildRosterPrompt(teams) {
  const teamPrompts = teams
    .filter((team) => team.members.length > 0)
    .map((team) => `${team.rosterTeam}报名辩手：${team.members.join('、')}`)
  return [
    ...teamPrompts,
    '请准确转写每次“一辩、二辩、三辩、四辩”之后说出的姓名。',
  ].join(' ')
}
