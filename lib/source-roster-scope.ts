type SourceRosterScope = {
  season_year: number | null
  league_name: string | null
  flight: string | null
  player_name: string | null
}

/** Match the ingestion key, which removes punctuation from source identities. */
export function sourceRosterTeamKey(team: string) {
  return team.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Unknown source context is never evidence for a selected season or flight. */
export function sourceRosterForScope<T extends SourceRosterScope>(rows: T[], scope: { season: string; league?: string | null; flight?: string | null }): T[] {
  const scoped = rows.filter(row => (scope.season === 'all' || String(row.season_year) === scope.season)
    && (!scope.league || row.league_name === scope.league)
    && (!scope.flight || row.flight === scope.flight))
  // Filter before deduplicating so an old entry cannot hide the current one.
  return [...new Map(scoped.filter(row => row.player_name?.trim()).map(row => [row.player_name!.trim().toLowerCase(), row])).values()]
}

export function sourceRosterCountKey(team: string, season: string | number | null) {
  return JSON.stringify([sourceRosterTeamKey(team), season === null ? null : String(season)])
}
