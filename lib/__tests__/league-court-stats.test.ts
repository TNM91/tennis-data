import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { leagueCourtLeaders, leagueCourtScorePatterns, loadLeagueCourtData, type LeagueCourtPlayer } from '../league-court-stats'
import type { TeamCourtMatch } from '../team-court-results'

const court = (id: string, score = '6-0 7-6(5)'): TeamCourtMatch => ({ id, external_match_id: `event::line:${id}`, line_number: id, winner_side: 'B', match_type: 'singles', score })
const player = (match: string, side = 'A'): LeagueCourtPlayer => ({ match_id: match, side, player_id: 'p', players: { id: 'p', name: 'Player' } })

describe('league court statistics', () => {
  it('uses court winners, excludes team participants and deduplicates appearances', () => {
    expect(leagueCourtLeaders({ courts: [court('1'), court('2')], players: [player('1'), player('1'), player('2'), player('team-event', 'B')] }))
      .toEqual([{ id: 'p', name: 'Player', wins: 0, losses: 2, appearances: 2 }])
  })
  it('excludes ambiguous sides, undecided courts and unlinked players', () => {
    expect(leagueCourtLeaders({ courts: [court('1'), court('2'), { ...court('3'), winner_side: null }], players: [player('1'), player('1', 'B'), player('2'), player('3'), { ...player('2'), player_id: 'unknown' }] })).toEqual([])
  })
  it('counts independent set patterns, including a deciding match tiebreak', () => {
    expect(leagueCourtScorePatterns([court('1'), court('2', '6-4;4-6;10-8'), court('3', '6-0'), court('4', ''), { ...court('5'), winner_side: null }]))
      .toEqual({ dominant: 1, tiebreak: 1, threeSets: 1, missingScore: 2, total: 4 })
  })
  it('does not read the archive when there are no displayed dates', async () => {
    const client = { from() { throw new Error('Unexpected read') } } as unknown as SupabaseClient
    expect(await loadLeagueCourtData(client, { league: 'League' }, [])).toEqual({ data: { courts: [], players: [] }, error: null })
  })
  it('pages exact league parents and fails closed on a later page', async () => {
    const calls: { table: string; ops: { name: string; args: unknown[] }[] }[] = []
    const client = { from(table: string) {
      const call = { table, ops: [] as { name: string; args: unknown[] }[] }
      const query: object = new Proxy({}, { get(_, name: string) {
        if (name === 'then') return (resolve: (value: unknown) => void) => {
          calls.push(call)
          resolve(calls.length === 1 ? { data: Array.from({ length: 200 }, (_, i) => ({ external_match_id: `parent-${i}`, match_date: '2026-10-01' })) } : { error: { message: 'Unavailable' } })
        }
        return (...args: unknown[]) => { call.ops.push({ name, args }); return query }
      } })
      return query
    } } as unknown as SupabaseClient
    expect(await loadLeagueCourtData(client, { league: 'League', flight: '4.0', section: 'Section', district: 'District' }, ['2026-10-01', '2026-10-01']))
      .toEqual({ data: null, error: { message: 'Unavailable' } })
    expect(calls).toHaveLength(2)
    expect(calls[0].ops).toEqual(expect.arrayContaining([
      { name: 'eq', args: ['league_name', 'League'] }, { name: 'eq', args: ['flight', '4.0'] },
      { name: 'eq', args: ['usta_section', 'Section'] }, { name: 'eq', args: ['district_area', 'District'] },
      { name: 'in', args: ['match_date', ['2026-10-01']] }, { name: 'is', args: ['line_number', null] },
    ]))
    expect(calls[1].ops).toContainEqual({ name: 'range', args: [200, 399] })
  })
})
