import type { SupabaseClient } from '@supabase/supabase-js'

export type TeamCourtMatch = {
  id: string
  external_match_id: string | null
  winner_side: 'A' | 'B' | null
  match_type: 'singles' | 'doubles' | null
  line_number: string | null
}
type ReadResult<T> = { data: T[] | null; error: { message: string } | null }
const PAGE_SIZE = 200

function parentId(externalId: string | null) {
  const boundary = externalId?.lastIndexOf('::line:') ?? -1
  return boundary < 0 ? null : externalId!.slice(0, boundary)
}

/** Quote both the literal regex prefix and PostgREST's OR-filter grammar. */
export function teamCourtPrefixFilter(externalId: string) {
  const literal = externalId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = `^${literal}::line:`.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `external_match_id.match."${pattern}"`
}

/** Claim the team's exact parent locators before paging; a global date window
 * can fill the API's row cap with other teams and hide every relevant court. */
export async function loadTeamCourtResults(client: SupabaseClient, parentMatches: { externalId: string; matchDate: string | null }[]): Promise<ReadResult<TeamCourtMatch>> {
  const parents = [...new Map(parentMatches.filter(parent => parent.externalId).map(parent => [parent.externalId, parent])).values()]
  if (parents.some(parent => !parent.matchDate)) return { data: null, error: { message: 'Court history requires dated team scorecards.' } }
  const matches = new Map<string, TeamCourtMatch>()
  for (let start = 0; start < parents.length; start += 20) {
    const batchParents = parents.slice(start, start + 20)
    const batch = batchParents.map(parent => parent.externalId)
    const dates = [...new Set(batchParents.map(parent => parent.matchDate!))]
    const allowed = new Set(batch)
    for (let offset = 0; ; offset += PAGE_SIZE) {
      let query = client.from('matches').select('id,external_match_id,winner_side,match_type,line_number')
        .not('line_number', 'is', null).or(batch.map(teamCourtPrefixFilter).join(','))
      // Keep the existing date index available; an unbounded regex over the
      // historical archive is slower than this team's known fixture dates.
      if (dates.length) query = query.in('match_date', dates)
      const result = await query.order('id').range(offset, offset + PAGE_SIZE - 1)
      if (result.error) return { data: null, error: result.error }
      const rows = (result.data || []) as TeamCourtMatch[]
      for (const row of rows) if (allowed.has(parentId(row.external_match_id) || '')) matches.set(row.id, row)
      if (rows.length < PAGE_SIZE) break
    }
  }
  return { data: [...matches.values()], error: null }
}

/** Keep participant filters and response pages bounded for long team histories. */
export async function loadTeamCourtPlayers<T>(client: SupabaseClient, courtIds: string[], fields: string): Promise<ReadResult<T>> {
  const ids = [...new Set(courtIds.filter(Boolean))]
  const players: T[] = []
  for (let start = 0; start < ids.length; start += 50) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const result = await client.from('match_players').select(fields).in('match_id', ids.slice(start, start + 50))
        .order('match_id').order('side').order('seat').range(offset, offset + PAGE_SIZE - 1)
      if (result.error) return { data: null, error: result.error }
      const rows = (result.data || []) as unknown as T[]
      players.push(...rows)
      if (rows.length < PAGE_SIZE) break
    }
  }
  return { data: players, error: null }
}
