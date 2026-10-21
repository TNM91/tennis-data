export type TeamSeasonContext = {
  league_name?: string | null
  flight?: string | null
  match_date?: string | null
  season_year?: number | null
}

type Scope = { league?: string | null; flight?: string | null }
const clean = (value: string | null | undefined) => (value || '').trim()
const scopeKey = (row: TeamSeasonContext) => JSON.stringify([clean(row.league_name), clean(row.flight)])

/** Championship seasons can begin in the previous calendar year. */
export function teamSeasonYear(row: TeamSeasonContext): string | null {
  return /\b(20\d{2})\b/.exec(clean(row.league_name))?.[1]
    || (row.season_year && /^20\d{2}$/.test(String(row.season_year)) ? String(row.season_year) : null)
    || /^(20\d{2})-\d{2}-\d{2}/.exec(clean(row.match_date))?.[1]
    || null
}

function inScope(row: TeamSeasonContext, scope: Scope) {
  return (!scope.league || clean(row.league_name) === clean(scope.league))
    && (!scope.flight || clean(row.flight) === clean(scope.flight))
}

export function teamSeasonYears(contexts: TeamSeasonContext[], scope: Scope = {}) {
  return [...new Set(contexts.filter((row) => inScope(row, scope)).map(teamSeasonYear).filter((year): year is string => Boolean(year)))].sort((a, b) => b.localeCompare(a))
}

/** Include registered players before their first match without assigning an undated roster to unrelated seasons. */
export function teamRosterForSeason<T extends TeamSeasonContext>(
  members: T[],
  matches: TeamSeasonContext[],
  scope: Scope & { season: string },
): T[] {
  const seasonsByScope = new Map<string, Set<string>>()
  for (const match of matches) {
    const year = teamSeasonYear(match)
    if (!year || !clean(match.league_name)) continue
    const key = scopeKey(match)
    const years = seasonsByScope.get(key) || new Set<string>()
    years.add(year)
    seasonsByScope.set(key, years)
  }
  return members.filter((member) => {
    if (!inScope(member, scope)) return false
    if (scope.season === 'all') return true
    const year = teamSeasonYear(member)
    if (year) return year === scope.season
    const evidence = seasonsByScope.get(scopeKey(member))
    return evidence?.size === 1 && evidence.has(scope.season)
  })
}
