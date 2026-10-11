export type PublicTeamMatchRow = {
  id: string
  match_date: string | null
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  match_type: string | null
  score: string | null
  winner_side: string | null
  public_history_eligible: boolean
}
export type PublicTeamResult = {
  id: string; date: string; opponent: string; league: string | null; flight: string | null
  format: 'singles' | 'doubles'; score: string; result: 'W' | 'L'
}
export type PublicTeamEvidence = { name: string; results: PublicTeamResult[] }

export function isPublicEvidenceTeamName(value: string | null | undefined, league?: string | null) {
  const name = value?.trim() || ''
  if (name.length < 2 || name.length > 180 || /[\u0000-\u001f]/.test(name)) return false
  if (/^(match results|home team|away team|visiting team|team name|team|tbd|unknown|n\/a)$/i.test(name)) return false
  if (league?.trim().toLowerCase() === name.toLowerCase() || /^20\d{2}\s+adult\b/i.test(name)) return false
  return true
}

export function quotePublicTeamFilter(name: string) {
  return `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function buildPublicTeamEvidence(rows: PublicTeamMatchRow[], today = new Date().toISOString().slice(0, 10)): PublicTeamEvidence[] {
  const teams = new Map<string, PublicTeamEvidence>()
  const seen = new Set<string>()
  const sorted = [...rows].sort((a, b) => (b.match_date || '').localeCompare(a.match_date || '') || b.id.localeCompare(a.id))
  for (const row of sorted) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    const date = row.match_date?.slice(0, 10) || ''
    const score = row.score?.trim() || ''
    if (row.public_history_eligible !== true || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > today) continue
    if (row.match_type !== 'singles' && row.match_type !== 'doubles') continue
    if (row.winner_side !== 'A' && row.winner_side !== 'B') continue
    if (!isPublicEvidenceTeamName(row.home_team, row.league_name) || !isPublicEvidenceTeamName(row.away_team, row.league_name)) continue
    const home = row.home_team!.trim()
    const away = row.away_team!.trim()
    if (home.toLowerCase() === away.toLowerCase()) continue
    if (/\b(ret(?:ired)?|wo|w\/o|walkover|default|def)\b/i.test(score)) continue
    if (![...score.matchAll(/(\d+)\s*[-–]\s*(\d+)/g)].some(([, a, b]) => Math.max(Number(a), Number(b)) >= 6)) continue
    for (const [name, opponent, side] of [[home, away, 'A'], [away, home, 'B']]) {
      const key = name.toLowerCase()
      const evidence = teams.get(key) || { name, results: [] }
      if (evidence.results.length < 6) evidence.results.push({
        id: row.id, date, opponent, league: row.league_name?.trim() || null, flight: row.flight?.trim() || null,
        format: row.match_type, score, result: row.winner_side === side ? 'W' : 'L',
      })
      teams.set(key, evidence)
    }
  }
  return [...teams.values()]
}

export function isDiscoverablePublicTeam(team: PublicTeamEvidence | null) {
  return Boolean(team && team.results.length >= 3)
}

export function publicTiqRead(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1.5 && value <= 7 ? `${Math.floor(value)}.XX` : null
}
