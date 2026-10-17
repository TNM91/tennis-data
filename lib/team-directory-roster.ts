type RosterScope = { team_name: string | null; league_name: string | null; flight: string | null; player_id: string | null }

export function teamDirectoryRosterKey(team: string | null, league: string | null, flight: string | null) {
  const normalize = (value: string | null) => (value || '').trim().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').toLowerCase()
  return JSON.stringify([normalize(team), normalize(league), normalize(flight)])
}

export function indexTeamDirectoryRoster(rows: RosterScope[]) {
  const ids: Record<string, string[]> = {}
  for (const row of rows) {
    if (!row.team_name?.trim() || !row.player_id?.trim()) continue
    const key = teamDirectoryRosterKey(row.team_name, row.league_name, row.flight)
    const players = ids[key] ||= []
    if (!players.includes(row.player_id)) players.push(row.player_id)
  }
  return ids
}
