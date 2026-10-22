import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadLeagueMatchHistory } from '../league-match-history'

type Call = { table: string; ops: { name: string; args: unknown[] }[] }
function fixture(respond: (call: Call) => unknown) {
  const calls: Call[] = []
  const client = { from(table: string) {
    const call: Call = { table, ops: [] }
    const query: object = new Proxy({}, { get(_, name: string) {
      if (name === 'then') return (resolve: (result: unknown) => void) => { calls.push(call); resolve(respond(call)) }
      return (...args: unknown[]) => { call.ops.push({ name, args }); return query }
    } })
    return query
  } } as unknown as SupabaseClient
  return { client, calls }
}
const offset = (call: Call) => call.ops.find(op => op.name === 'range')!.args[0] as number
const match = (i: number) => ({ id: String(i), home_team: i === 200 ? 'Older team' : 'Current team', away_team: 'Opponent', winner_side: 'A' })

describe('complete league match history', () => {
  it('includes older matches and teams beyond the first 200 results', async () => {
    const f = fixture(call => ({ data: offset(call) === 0 ? Array.from({ length: 200 }, (_, i) => match(i)) : [match(200)] }))
    const result = await loadLeagueMatchHistory(f.client, { league: 'League', flight: '4.0', section: 'Section', district: 'District' })
    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(201)
    expect(result.data!.at(-1)?.home_team).toBe('Older team')
    for (const call of f.calls) {
      expect(call.table).toBe('team_match_results')
      expect(call.ops).toEqual(expect.arrayContaining([
        { name: 'eq', args: ['league_name', 'League'] }, { name: 'eq', args: ['flight', '4.0'] },
        { name: 'eq', args: ['usta_section', 'Section'] }, { name: 'eq', args: ['district_area', 'District'] },
        { name: 'is', args: ['line_number', null] }, { name: 'order', args: ['id'] },
        { name: 'order', args: ['match_date', { ascending: false }] },
      ]))
      expect(call.ops.some(op => op.name === 'limit')).toBe(false)
    }
    expect(f.calls.map(offset)).toEqual([0, 200])
  })
  it('does not publish partial standings if a later page fails', async () => {
    const f = fixture(call => offset(call) === 0 ? { data: Array.from({ length: 200 }, (_, i) => match(i)) } : { error: { message: 'Read failed' } })
    expect(await loadLeagueMatchHistory(f.client, { league: 'League' })).toEqual({ data: null, error: { message: 'Read failed' } })
  })
  it('stops reading when the user leaves the league', async () => {
    let current = true
    const f = fixture(() => { current = false; return { data: Array.from({ length: 200 }, (_, i) => match(i)) } })
    expect((await loadLeagueMatchHistory(f.client, { league: 'League' }, () => current)).data).toBeNull()
    expect(f.calls).toHaveLength(1)
  })
  it('handles empty scopes and exact full pages without dropping or duplicating records', async () => {
    const f = fixture(call => ({ data: offset(call) === 0 ? Array.from({ length: 200 }, (_, i) => match(i)) : [] }))
    expect((await loadLeagueMatchHistory(f.client, { league: 'League' })).data).toHaveLength(200)
    expect(f.calls.map(offset)).toEqual([0, 200])
    const empty = fixture(() => ({ data: [] }))
    expect((await loadLeagueMatchHistory(empty.client, { league: 'League' })).data).toEqual([])
  })
})
