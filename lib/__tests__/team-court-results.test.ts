import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadTeamCourtPlayers, loadTeamCourtResults, teamCourtPrefixFilter } from '../team-court-results'

type Call = { table: string; ops: { name: string; args: unknown[] }[] }
function fixture(respond: (call: Call) => { data?: unknown; error?: { message: string } }) {
  const calls: Call[] = []
  return { calls, client: { from(table: string) {
    const call: Call = { table, ops: [] }
    const query: object = new Proxy({}, { get(_, name: string) {
      if (name === 'then') return (resolve: (value: unknown) => void) => { calls.push(call); resolve(respond(call)) }
      return (...args: unknown[]) => { call.ops.push({ name, args }); return query }
    } })
    return query
  } } as unknown as SupabaseClient }
}
const op = (call: Call, name: string) => call.ops.find(o => o.name === name)?.args
const readCourts = (client: SupabaseClient, ids: string[], dates = ['2026-09-13']) => loadTeamCourtResults(client, ids.map((externalId, i) => ({ externalId, matchDate: dates[i % dates.length] || null })))
const line = (id: string, parent = 'team-event') => ({ id, external_match_id: `${parent}::line:1`, line_number: '1', winner_side: 'A', match_type: 'singles' })

describe('scoped team court reads', () => {
  it('filters exact parent locators on the server before reading a response page', async () => {
    const f = fixture(() => ({ data: [line('ours'), line('foreign', 'another-event')] }))
    expect(await readCourts(f.client, ['team-event'], ['2026-09-13'])).toMatchObject({ data: [line('ours')], error: null })
    expect(op(f.calls[0], 'or')).toEqual(['external_match_id.match."^team-event::line:"'])
    expect(op(f.calls[0], 'range')).toEqual([0, 199])
    expect(op(f.calls[0], 'in')).toEqual(['match_date', ['2026-09-13']])
    expect(f.calls[0].ops.some(o => ['gte', 'lte'].includes(o.name))).toBe(false)
  })
  it('pages through every matching court instead of silently stopping at an API row cap', async () => {
    const f = fixture(call => ({ data: op(call, 'range')?.[0] === 0 ? Array.from({ length: 200 }, (_, i) => line(String(i))) : [line('last')] }))
    const result = await readCourts(f.client, ['team-event'], ['2026-09-13'])
    expect(result.data).toHaveLength(201)
    expect(f.calls.map(call => op(call, 'range'))).toEqual([[0, 199], [200, 399]])
  })
  it('does not count prepared lineups or undecided courts as played statistics', async () => {
    const f = fixture(() => ({ data: [line('played'), { ...line('scheduled'), winner_side: null }] }))
    expect((await readCourts(f.client, ['team-event'], ['2026-09-13'])).data).toEqual([line('played')])
    expect(f.calls[0].ops).toContainEqual({ name: 'in', args: ['winner_side', ['A', 'B']] })
  })
  it('bounds long parent filters and ignores duplicate discovery locators', async () => {
    const parents = Array.from({ length: 45 }, (_, i) => `event-${i}`)
    const f = fixture(() => ({ data: [] }))
    expect((await readCourts(f.client, [...parents, ...parents], ['2026-09-13'])).error).toBeNull()
    expect(f.calls).toHaveLength(3)
    expect(f.calls.map(call => String(op(call, 'or')?.[0]).split('external_match_id.match.').length - 1)).toEqual([20, 20, 5])
  })
  it('bounds fixture dates to each locator batch, not the entire team history', async () => {
    const parents = Array.from({ length: 45 }, (_, i) => ({ externalId: 'event-' + i, matchDate: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10) }))
    const f = fixture(() => ({ data: [] }))
    await loadTeamCourtResults(f.client, parents)
    expect(f.calls.map(call => (op(call, 'in')?.[1] as string[]).length)).toEqual([20, 20, 5])
  })
  it('escapes regex metacharacters and the quoted PostgREST filter grammar', () => {
    const value = teamCourtPrefixFilter('event.[x]*%_"\\')
    expect(value).toBe('external_match_id.match."^event\\\\.\\\\[x\\\\]\\\\*%_\\"\\\\\\\\::line:"')
  })
  it('does not admit a nested or unrelated parent from a broad backend response', async () => {
    const f = fixture(() => ({ data: [line('ours'), line('nested', 'team-event::line:1')] }))
    expect((await readCourts(f.client, ['team-event'], ['2026-09-13'])).data).toEqual([line('ours')])
  })
  it('does not report partial statistics when a later response fails', async () => {
    const f = fixture(call => op(call, 'range')?.[0] === 0 ? { data: Array.from({ length: 200 }, (_, i) => line(String(i))) } : { error: { message: 'read failed' } })
    expect(await readCourts(f.client, ['team-event'], ['2026-09-13'])).toEqual({ data: null, error: { message: 'read failed' } })
  })
  it('does not scan an undated archive when fixture dates are missing', async () => {
    const f = fixture(() => ({ data: [] }))
    expect((await readCourts(f.client, ['team-event'], [])).error?.message).toContain('dated team scorecards')
    expect(f.calls).toEqual([])
  })
  it('does no reads for an empty parent or court list', async () => {
    const f = fixture(() => ({ data: [] }))
    expect(await readCourts(f.client, [], [])).toEqual({ data: [], error: null })
    expect(await loadTeamCourtPlayers(f.client, [], 'match_id')).toEqual({ data: [], error: null })
    expect(f.calls).toEqual([])
  })
  it('bounds participant ID filters and pages all participant rows', async () => {
    const f = fixture(call => ({ data: op(call, 'range')?.[0] === 0 ? Array.from({ length: 200 }, (_, i) => ({ match_id: String(i) })) : [{ match_id: 'last' }] }))
    const result = await loadTeamCourtPlayers(f.client, Array.from({ length: 55 }, (_, i) => String(i)), 'match_id')
    expect(result.data).toHaveLength(402)
    expect(f.calls.map(call => (op(call, 'in')?.[1] as string[]).length)).toEqual([50, 50, 5, 5])
  })
})
