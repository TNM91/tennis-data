import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  responses: [] as Array<{ data: unknown[] | null; error: { code: string; message: string } | null }>,
  matchCalls: 0,
  contextCalls: 0,
  waitForAbort: false,
}))
vi.mock('@/lib/supabase', () => ({ supabaseUrl: 'https://example.invalid', supabaseKey: 'public-fixture' }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        is: () => chain,
        order: () => chain,
        range: () => chain,
        abortSignal: (signal: AbortSignal) => {
          state.matchCalls++
          if (state.waitForAbort) return new Promise(resolve => signal.addEventListener('abort', () => resolve({ data: null, error: { code: '', message: 'Request aborted' } }), { once: true }))
          return Promise.resolve(state.responses.shift() ?? { data: [], error: null })
        },
        limit: () => {
          state.contextCalls++
          return Promise.resolve({ data: table === 'team_summary_teams' ? [{ team_name: 'Aces', league_name: '2026 Spring League', flight: '4.0', usta_section: null, district_area: null }] : [], error: null })
        },
      }
      return chain
    },
  }),
}))
import { fetchLeagueSummary } from '@/lib/league-summary'

const match = (id: number) => ({ id: String(id), external_match_id: null, league_name: '2026 Spring League', flight: '4.0', usta_section: null, district_area: null, home_team: 'Aces', away_team: 'Rallies', match_date: '2026-10-30', source: 'schedule', line_number: null })
beforeEach(() => { state.responses = []; state.matchCalls = 0; state.contextCalls = 0; state.waitForAbort = false })
afterEach(() => vi.useRealTimers())

describe('league directory bounded timeout recovery', () => {
  it('retains team discovery and marks incomplete totals when PostgreSQL times out', async () => {
    state.responses.push({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } })
    const result = await fetchLeagueSummary()
    expect(result.leagues).toHaveLength(1)
    expect(result.leagues[0].teamCount).toBe(1)
    expect(result.totalMatches).toBe(0)
    expect(result.notice).toContain('summary timeout')
    expect(state.matchCalls).toBe(1)
    expect(state.contextCalls).toBe(2)
  })

  it('preserves already loaded counts without retrying a timed-out next page', async () => {
    state.responses.push({ data: Array.from({ length: 500 }, (_, id) => match(id)), error: null }, { data: null, error: { code: '57014', message: 'statement timeout' } })
    const result = await fetchLeagueSummary()
    expect(result.totalMatches).toBe(500)
    expect(result.diagnostics.totalParentMatches).toBe(500)
    expect(result.leagues[0].matchCount).toBe(500)
    expect(result.notice).toContain('500 parent matches')
    expect(state.matchCalls).toBe(2)
  })

  it('handles the SDK returning an error after the seven-second client abort', async () => {
    vi.useFakeTimers()
    state.waitForAbort = true
    const pending = fetchLeagueSummary()
    await vi.advanceTimersByTimeAsync(7001)
    const result = await pending
    expect(result.notice).toContain('summary timeout')
    expect(result.leagues).toHaveLength(1)
    expect(state.matchCalls).toBe(1)
  })

  it('keeps ordinary database errors visible and complete reads complete', async () => {
    state.responses.push({ data: null, error: { code: '42P01', message: 'Required relation is missing' } })
    await expect(fetchLeagueSummary()).rejects.toThrow('Required relation is missing')
    expect(state.contextCalls).toBe(0)
    state.responses.push({ data: [match(1)], error: null })
    const result = await fetchLeagueSummary()
    expect(result.totalMatches).toBe(1)
    expect(result.notice).toBeNull()
  })
})
