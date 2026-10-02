import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLeagueWeeklyCourts } from '../league-weekly-format'
const mocks = vi.hoisted(() => ({ from: vi.fn(), write: vi.fn(), session: {} as Record<string, unknown> }))
vi.mock('../captain-availability-request-server', () => ({
  isUuid: () => true,
  cleanAvailabilityText: (value: unknown) => typeof value === 'string' ? value.trim() : '',
  getCaptainAvailabilityServiceClient: () => ({ from: mocks.from }),
}))
import { GET, POST } from '../../app/api/leagues/weekly/[token]/route'
const params = Promise.resolve({ token: 'fixture' })
const post = (body: Record<string, unknown>) => new Request('https://example.test/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerName: 'A', ...body }) })
function query(table: string, data: unknown) {
  const chain = {
    select: () => chain, eq: () => chain, order: () => chain,
    maybeSingle: async () => ({ data, error: null }),
    upsert: async (value: unknown) => { mocks.write(table, value); return { error: null } },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
  }
  return chain
}
describe('player weekly response API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.session = { id: 'week', league_id: 'league', play_on: '2026-10-08', response_deadline: '2099-10-07T18:00:00Z', status: 'collecting', roster: ['A'], assignments: buildLeagueWeeklyCourts(['A', 'B', 'C', 'D'], {}) }
    mocks.from.mockImplementation(table => query(table, table === 'tiq_league_weekly_sessions' ? mocks.session : table === 'tiq_leagues' ? { league_name: 'League', players: ['A', 'B', 'C', 'D'], weekly_settings: {} } : table === 'tiq_league_weekly_responses' ? { response_status: 'in', note: 'private note', positive_share: 'private story' } : table === 'tiq_league_weekly_change_requests' ? { status: 'pending', reason: 'private reason' } : []))
  })
  it('rejects late replies even while the coordinator is still collecting', async () => {
    mocks.session.response_deadline = '2020-01-01T00:00:00Z'
    const response = await POST(post({ action: 'rsvp', responseStatus: 'in' }), { params })
    expect(response.status).toBe(409)
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it('records a withdrawal request without removing players or changing courts', async () => {
    mocks.session.status = 'published'
    expect((await POST(post({ action: 'withdraw', reason: 'Work conflict' }), { params })).status).toBe(200)
    expect(mocks.write).toHaveBeenCalledOnce()
    expect(mocks.write).toHaveBeenCalledWith('tiq_league_weekly_change_requests', expect.objectContaining({ player_name: 'A', status: 'pending' }))
  })
  it('rejects completed-week withdrawals and unknown names', async () => {
    mocks.session.status = 'completed'
    expect((await POST(post({ action: 'withdraw' }), { params })).status).toBe(409)
    expect((await POST(post({ action: 'withdraw', playerName: 'Stranger' }), { params })).status).toBe(400)
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it('returns saved personal status without sharing private notes or stories', async () => {
    const response = await GET(new Request('https://example.test/api?playerName=A'), { params })
    const payload = await response.json()
    expect(payload.player).toEqual({ name: 'A', responseStatus: 'in', withdrawalPending: true })
    expect(JSON.stringify(payload)).not.toContain('private')
    expect(payload.week.assignments).toEqual([])
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('does not coerce blank or null game counts to zero', async () => {
    mocks.session.status = 'published'
    for (const sideBGames of ['', null]) expect((await POST(post({ action: 'score', courtNumber: 1, setNumber: 1, sideAGames: 6, sideBGames }), { params })).status).toBe(400)
    expect(mocks.write).not.toHaveBeenCalled()
  })
})
