import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ auth: vi.fn(), authorize: vi.fn(), roster: vi.fn(), invites: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/captain-api-auth', () => ({ getCaptainApiAuth: mock.auth }))
vi.mock('@/lib/captain-availability-request-server', () => ({ getCaptainAvailabilityServiceClient: () => ({ from: mock.from }) }))
vi.mock('@/lib/season-kickoff-server', () => ({ authorizeSeason: mock.authorize, loadSeasonRoster: mock.roster, loadSeasonInvites: mock.invites, seasonToday: () => '2026-09-08', seasonPrivateHeaders: { 'Cache-Control': 'private, no-store' } }))
import { GET } from '@/app/api/captain/team-availability-summary/route'

const match = { id: 'm1', home_team: 'Aces', away_team: 'Volleys', league_name: '2027 Fall', flight: '4.0', match_date: '2026-09-14', match_time: '18:00:00' }
const path = 'https://example.test/api/captain/team-availability-summary?team=Aces&league=2027+Fall&flight=4.0&date=2026-09-14&opponent=Volleys'
let rows: Record<string, unknown[]>
let errors: Set<string>
let queries: Record<string, Record<string, ReturnType<typeof vi.fn>>>
beforeEach(() => {
  vi.resetAllMocks(); queries = {}; errors = new Set()
  mock.auth.mockResolvedValue({ ok: true, userId: 'captain' }); mock.authorize.mockResolvedValue(true)
  mock.roster.mockResolvedValue([{ key: 'p1', name: 'Jordan', playerId: 'p1' }]); mock.invites.mockResolvedValue([])
  rows = { matches: [match], lineup_availability: [], lineup_scenarios: [], captain_lineup_drafts: [], captain_availability_requests: [], captain_availability_request_responses: [], season_availability_responses: [] }
  mock.from.mockImplementation((table: string) => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of ['select', 'eq', 'is', 'or', 'limit', 'in', 'gt', 'order']) query[method] = vi.fn(() => query)
    query.then = vi.fn(resolve => resolve({ data: rows[table], error: errors.has(table) ? { message: 'failure' } : null }))
    queries[table] = query
    return query
  })
})
describe('captain summary read API', () => {
  it('requires authentication and exact team captain authorization before private reads', async () => {
    mock.auth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) })
    expect((await GET(new Request(path))).status).toBe(401)
    expect(mock.from).not.toHaveBeenCalled()
    mock.auth.mockResolvedValue({ ok: true, userId: 'captain' }); mock.authorize.mockResolvedValue(false)
    expect((await GET(new Request(path))).status).toBe(403)
    expect(mock.roster).not.toHaveBeenCalled()
  })
  it('keeps exact league and flight filters and returns no invitation tokens or raw notes', async () => {
    rows.lineup_availability = [{ player_id: 'p1', status: 'available', notes: 'Confirmed by captain from Lineup Builder.', updated_at: '2026-09-08T01:00:00Z' }]
    const response = await GET(new Request(path)); const body = await response.json()
    expect(body.summary).toMatchObject({ available: 1, captainConfirmed: 1, waiting: 0 })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mock.authorize).toHaveBeenCalledWith(expect.anything(), 'captain', expect.objectContaining({ team: 'Aces', league: '2027 Fall', flight: '4.0' }))
    for (const table of ['matches', 'lineup_availability', 'lineup_scenarios', 'captain_availability_requests']) {
      expect(queries[table].eq).toHaveBeenCalledWith('league_name', '2027 Fall')
      expect(queries[table].eq).toHaveBeenCalledWith('flight', '4.0')
    }
    expect(JSON.stringify(body)).not.toContain('response_token')
    expect(JSON.stringify(body)).not.toContain('notes')
  })
  it('does not guess which of multiple saved lineups is current', async () => {
    rows.lineup_scenarios = [{ id: 's1', slots_json: [] }, { id: 's2', slots_json: [] }]
    expect(await (await GET(new Request(path))).json()).toMatchObject({ selection: 'choose', scenarioId: '', summary: { selectedWaiting: null } })
  })
  it('shows selected waiting names from the single matching saved lineup', async () => {
    rows.lineup_scenarios = [{ id: 's1', slots_json: [{ players: [{ playerId: 'p1' }] }] }]
    expect(await (await GET(new Request(path))).json()).toMatchObject({ selection: 'saved', scenarioId: 's1', summary: { selectedWaiting: ['Jordan'] } })
  })
  it('uses the current cloud Match Week draft before an older saved scenario', async () => {
    mock.roster.mockResolvedValue([
      { key: 'p1', name: 'Jordan', playerId: 'p1' },
      { key: 'p2', name: 'Casey', playerId: 'p2' },
    ])
    rows.lineup_scenarios = [{ id: 'old', slots_json: [{ players: [{ playerId: 'p1' }] }] }]
    rows.captain_lineup_drafts = [{ scenario_id: null, slots_json: [{ players: [{ playerId: 'p2' }] }], updated_at: '2026-09-08T12:00:00Z' }]
    const body = await (await GET(new Request(`${path}&layer=usta`))).json()
    expect(body).toMatchObject({ selection: 'draft', summary: { selectedWaiting: ['Casey'] } })
    expect(queries.captain_lineup_drafts.eq).toHaveBeenCalledWith('competition_layer', 'usta')
  })
  it('never silently reports zero when data fails or a bounded query is incomplete', async () => {
    errors.add('lineup_availability')
    expect((await GET(new Request(path))).status).toBe(503)
    errors.clear(); rows.lineup_availability = Array(251).fill({})
    expect((await GET(new Request(path))).status).toBe(503)
  })
  it('does not merge ambiguous fixtures or day-only answers on double headers', async () => {
    rows.matches = [match, { ...match, id: 'm2' }]
    expect((await GET(new Request(path))).status).toBe(409)
    rows.matches = [match, { ...match, id: 'm2', away_team: 'Other' }]
    rows.lineup_availability = [{ player_id: 'p1', status: 'available', notes: 'Confirmed by captain from Lineup Builder.' }]
    expect(await (await GET(new Request(path))).json()).toMatchObject({ dayScopedAnswersOmitted: true, summary: { available: 0, waiting: 1 } })
  })
  it('counts only active, allowed, current fixture season replies', async () => {
    mock.invites.mockResolvedValue([{ id: 'i1', roster_key: 'p1', player_id: 'p1', match_ids: ['m1'], revoked_at: null }, { id: 'revoked', match_ids: ['m1'], revoked_at: 'stopped' }])
    rows.season_availability_responses = [{ invite_id: 'i1', match_id: 'm1', match_date: match.match_date, match_time: '17:00:00', status: 'available' }]
    expect((await (await GET(new Request(path))).json()).summary.available).toBe(0)
    rows.season_availability_responses = [{ invite_id: 'i1', match_id: 'm1', match_date: match.match_date, match_time: match.match_time, status: 'available' }]
    expect((await (await GET(new Request(path))).json()).summary.available).toBe(1)
    expect(queries.season_availability_responses.in).toHaveBeenCalledWith('invite_id', ['i1'])
  })
  it('recognizes a personal reply mirror as a player reply, not a captain confirmation', async () => {
    rows.captain_availability_requests = [{ id: 'r1', match_time: match.match_time }]
    rows.captain_availability_request_responses = [{ player_id: 'p1', status: 'available', responded_at: '2026-09-08T01:00:00Z' }]
    rows.lineup_availability = [{ player_id: 'p1', status: 'available', notes: null, updated_at: '2026-09-08T01:00:00.250Z' }]
    const body = await (await GET(new Request(path))).json()
    expect(body.summary.people[0].source).toBe('player')
  })
})
