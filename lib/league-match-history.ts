import type { SupabaseClient } from '@supabase/supabase-js'

export type LeagueMatchRow = {
  source_url?: string | null
  id: string
  league_name: string | null
  flight: string | null
  usta_section: string | null
  district_area: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
  match_type: 'singles' | 'doubles' | null
  score: string | null
  winner_side: 'A' | 'B' | null
  status: string | null
}

/** Read the complete exact scope before publishing standings. Nearby-scope
 * diagnostics are separate and must never contribute to league records. */
export async function loadLeagueMatchHistory(client: SupabaseClient, scope: {
  league: string; flight?: string; section?: string; district?: string
}, isCurrent: () => boolean = () => true): Promise<{
  data: LeagueMatchRow[] | null; error: { message: string } | null
}> {
  const rows = new Map<string, LeagueMatchRow>()
  for (let offset = 0; ; offset += 200) {
    if (!isCurrent()) return { data: null, error: { message: 'League request superseded.' } }
    let query = client.from('team_match_results')
      .select('id,source_url,league_name,flight,usta_section,district_area,home_team,away_team,match_date,match_type,score,winner_side,status')
      .eq('league_name', scope.league).is('line_number', null)
    if (scope.flight) query = query.eq('flight', scope.flight)
    if (scope.section) query = query.eq('usta_section', scope.section)
    if (scope.district) query = query.eq('district_area', scope.district)
    const result = await query.order('match_date', { ascending: false }).order('id')
      .range(offset, offset + 199)
    if (result.error) return { data: null, error: result.error }
    if (!isCurrent()) return { data: null, error: { message: 'League request superseded.' } }
    const batch = (result.data || []) as LeagueMatchRow[]
    for (const row of batch) rows.set(row.id, row)
    if (batch.length < 200) return { data: [...rows.values()], error: null }
  }
}
