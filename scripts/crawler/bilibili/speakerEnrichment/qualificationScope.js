export function isQualificationScopeMatch(match, {
  year,
} = {}) {
  const matchYear = year ?? determineYear(match)
  const text = `${match.event ?? ''} ${match.stage ?? ''} ${match.title ?? ''}`
  if (matchYear === 2024) {
    const date = String(match.date ?? '')
    const inQualificationWindow = date >= '2024-07-01' && date <= '2024-11-30'
    return inQualificationWindow
      && /资格赛|初赛|复赛|晋级赛|半决赛|线上赛段|线下赛段|合集：资格赛/.test(text)
  }
  return /资格赛/.test(text)
}

export function determineYear(match) {
  return Number(
    String(match.event ?? '').match(/20\d{2}/)?.[0]
      ?? String(match.date ?? '').match(/20\d{2}/)?.[0]
      ?? String(match.title ?? '').match(/20\d{2}/)?.[0]
      ?? 0,
  )
}
