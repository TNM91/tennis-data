import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLeagueWeeklyCourts } from '../league-weekly-format'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), rpc: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser }, from: mocks.from, rpc: mocks.rpc }) }))
vi.mock('../supabase', () => ({ supabaseUrl: 'https://example.supabase.co', supabaseKey: 'test' }))
vi.mock('../captain-availability-request-server', () => ({ cleanAvailabilityText: (value: unknown) => typeof value === 'string' ? value.trim() : '' }))
import { POST } from '../../app/api/leagues/weekly/sessions/[sessionId]/scores/route'
const params = Promise.resolve({ sessionId: 'week' })
const previous = { sideAGames: 6, sideBGames: 2, reviewStatus: 'approved' }
const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const request = (extra = {}, token = 'valid') => new Request('https://example.test/api', { method: 'POST', headers: token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : {}, body: JSON.stringify({ courtNumber: 1, setNumber: 1, sideAGames: 6, sideBGames: 3, expectedScore: previous, ...extra }) })
function query(data: unknown) { const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data, error: null }) }; return chain }
describe('league score corrections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
    mocks.rpc.mockResolvedValue({ error: null })
    mocks.from.mockImplementation(table => query(table === 'tiq_league_weekly_sessions' ? { id: 'week', league_id: 'league', league: { created_by_user_id: 'owner' }, assignments: buildLeagueWeeklyCourts(['A','B','C','D'], {}) } : table === 'tiq_league_weekly_set_results' ? { side_a_games: 6, side_b_games: 2, review_status: 'approved' } : null))
  })
  afterEach(() => { if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey })
  it('requires sign-in and league manager access', async () => {
    expect((await POST(request({}, ''), { params })).status).toBe(401)
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'stranger' } }, error: null })
    expect((await POST(request(), { params })).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('requires a reason for a changed official score', async () => {
    const response = await POST(request(), { params })
    expect(response.status).toBe(400)
    expect((await response.json()).message).toContain('reason')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('approves atomically with an expected-score snapshot and correction reason', async () => {
    expect((await POST(request({ reviewNote: 'Corrected court sheet' }), { params })).status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('approve_tiq_weekly_score', expect.objectContaining({ expected_score: previous, correction_note: 'Corrected court sheet', games_b: 3 }))
  })
  it('returns a conflict when another coordinator changed the score', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'This score changed. Refresh before approving it.' } })
    expect((await POST(request({ reviewNote: 'Correction' }), { params })).status).toBe(409)
  })
})
