import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), scope: vi.fn(), roster: vi.fn(), self: vi.fn(), fixtures: vi.fn() }))
vi.mock('@/lib/player-api-auth', () => ({ getSignedInPlayerApiAuth: mock.auth }))
vi.mock('@/lib/captain-availability-request-server', () => ({ getCaptainAvailabilityServiceClient: () => ({ from: mock.from }) }))
vi.mock('@/lib/season-kickoff-server', () => ({ readSeasonScope: mock.scope, loadSeasonRoster: mock.roster, loadSeasonSelf: mock.self,
  loadSeasonFixtures: mock.fixtures, seasonPrivateHeaders: { 'Cache-Control': 'private, no-store' } }))
import { GET } from '@/app/api/team-availability/route'
const scope = { team: 'Aces', league: 'Fall', flight: '4.0', seasonKey: '2027' }
const req = (extra = '') => new Request(`https://example.test/api/team-availability?${new URLSearchParams(scope)}${extra}`)
function chain(result: unknown) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const key of ['select', 'eq', 'maybeSingle']) q[key] = vi.fn(() => q)
  q.then = vi.fn((resolve: (value: unknown) => void) => resolve(result))
  return q
}
let links: ReturnType<typeof chain>
let invite: ReturnType<typeof chain>
beforeEach(() => {
  vi.resetAllMocks()
  mock.auth.mockResolvedValue({ ok: true, userId: 'signed-in-player' })
  mock.scope.mockReturnValue(scope)
  mock.roster.mockResolvedValue([{ key: 'own-key', playerId: 'own-id', name: 'Taylor' }])
  mock.self.mockResolvedValue({ key: 'own-key', playerId: 'own-id', name: 'Taylor' })
  mock.fixtures.mockResolvedValue([{ id: 'fixture-1' }])
  links = chain({ data: [{ league_name: 'Fall', flight: '4.0' }], error: null })
  invite = chain({ data: { response_token: 'own-private-token', revoked_at: null, match_ids: ['fixture-1'] }, error: null })
  mock.from.mockImplementation(table => table === 'team_profile_links' ? links : invite)
})
describe('shared team availability identity boundary', () => {
  it('requires sign-in before any service data is read', async () => {
    mock.auth.mockResolvedValue({ ok: false })
    expect((await GET(req())).status).toBe(401)
    expect(mock.from).not.toHaveBeenCalled()
  })
  it('rejects malformed scope privately', async () => {
    mock.scope.mockImplementation(() => { throw Error('bad scope') })
    const result = await GET(req())
    expect(result.status).toBe(400)
    expect(result.headers.get('cache-control')).toBe('private, no-store')
  })
  it.each([[], [{ league_name: 'Other league', flight: '4.0' }], [{ league_name: 'Fall', flight: '4.5' }]])('requires an accepted link to the exact team/league/flight', async (...rows) => {
    links = chain({ data: rows.length === 1 && Array.isArray(rows[0]) ? rows[0] : rows, error: null })
    expect((await GET(req())).status).toBe(403)
    expect(mock.self).not.toHaveBeenCalled()
  })
  it('queries accepted membership by authenticated user and normalized team', async () => {
    await GET(req())
    expect(links.eq).toHaveBeenCalledWith('profile_user_id', 'signed-in-player')
    expect(links.eq).toHaveBeenCalledWith('normalized_team_name', 'aces')
    expect(links.eq).toHaveBeenCalledWith('status', 'accepted')
  })
  it('rejects unlinked/removed roster identities instead of guessing names', async () => {
    mock.self.mockResolvedValue(null)
    expect((await GET(req('&playerId=victim'))).status).toBe(403)
    expect(mock.from).not.toHaveBeenCalledWith('season_availability_invites')
  })
  it('ignores supplied identity and tokens, returning only the authenticated player token', async () => {
    const result = await GET(req('&playerId=victim&responseToken=victim-secret&match=fixture-1'))
    expect(await result.json()).toEqual({ responseToken: 'own-private-token', focusMatchId: 'fixture-1' })
    expect(mock.self).toHaveBeenCalledWith(expect.anything(), 'signed-in-player', expect.any(Array))
    expect(invite.eq).toHaveBeenCalledWith('player_id', 'own-id')
    expect(invite.eq).toHaveBeenCalledWith('roster_key', 'own-key')
    for (const [column, value] of [['team_name', 'Aces'], ['league_name', 'Fall'], ['flight', '4.0'], ['season_key', '2027']]) expect(invite.eq).toHaveBeenCalledWith(column, value)
  })
  it.each([null, { revoked_at: 'stopped' }])('does not create or revive missing/stopped invitations', async data => {
    invite = chain({ data, error: null })
    expect((await GET(req())).status).toBe(404)
  })
  it('rejects another match or a fixture removed from the invitation', async () => {
    expect((await GET(req('&match=other-fixture'))).status).toBe(409)
    invite = chain({ data: { revoked_at: null, match_ids: [], response_token: 'own' }, error: null })
    expect((await GET(req('&match=fixture-1'))).status).toBe(409)
  })
  it('fails closed when membership lookup fails', async () => {
    links = chain({ data: null, error: { message: 'db failed' } })
    expect((await GET(req())).status).toBe(503)
    expect(mock.self).not.toHaveBeenCalled()
  })
})
