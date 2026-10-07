import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  tournament: { id: 'division', is_public: true, status: 'draft', is_event: false, registration_email: '' } as Record<string, unknown>,
  inserts: [] as Record<string, unknown>[],
}))
vi.mock('@/lib/supabase', () => ({ supabaseUrl: 'https://database.example.test' }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({
  rpc: async () => ({ data: true, error: null }),
  from: (table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({ data: state.tournament, error: null }),
      insert: (payload: Record<string, unknown>) => {
        if (table !== 'tiq_tournament_entries') throw new Error('Unexpected insert')
        state.inserts.push(payload)
        return query
      },
      single: async () => ({ data: { id: 'entry', ...state.inserts[0] }, error: null }),
    }
    return query
  },
}) }))

import { POST } from '@/app/api/tournaments/entries/route'

describe('registration targets a tournament division', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key')
    state.tournament = { id: 'division', is_public: true, status: 'draft', is_event: false, registration_email: '' }
    state.inserts = []
  })
  afterEach(() => vi.unstubAllEnvs())
  function request() {
    return new Request('https://tenaceiq.test/api/tournaments/entries', { method: 'POST',
      body: JSON.stringify({ tournamentId: 'division', playerName: 'Team A' }), headers: { 'content-type': 'application/json' } })
  }
  it('requires a division instead of accepting entries into the parent event', async () => {
    state.tournament.is_event = true
    const result = await POST(request())
    expect(result.status).toBe(400)
    expect(state.inserts).toEqual([])
  })
  it('honors direct director signup even if the entry API is called manually', async () => {
    state.tournament.registration_email = 'leskotennis11@gmail.com'
    const result = await POST(request())
    expect(result.status).toBe(400)
    expect((await result.json()).message).toContain('director')
    expect(state.inserts).toEqual([])
  })
  it('continues to accept public division entries with platform registration', async () => {
    const result = await POST(request())
    expect(result.status).toBe(200)
    expect(state.inserts[0]).toMatchObject({ tournament_id: 'division', player_name: 'Team A', status: 'pending' })
  })
  it('rejects entries after the configured registration deadline', async () => {
    state.tournament.event_details = { registrationClosesOn: '2000-01-01', timeZone: 'UTC' }
    const result = await POST(request())
    expect(result.status).toBe(400)
    expect((await result.json()).message).toContain('closed')
    expect(state.inserts).toEqual([])
  })
})
