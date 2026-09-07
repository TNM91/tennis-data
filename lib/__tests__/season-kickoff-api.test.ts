import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocked = vi.hoisted(() => ({ auth: vi.fn(), authorize: vi.fn(), fixtures: vi.fn(), roster: vi.fn(), invites: vi.fn(), replies: vi.fn(), recipient: vi.fn(), self: vi.fn(), from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/captain-api-auth', () => ({ getCaptainApiAuth: mocked.auth }))
vi.mock('@/lib/captain-availability-request-server', () => ({ getCaptainAvailabilityServiceClient: () => ({ from: mocked.from, rpc: mocked.rpc }), isUuid: (s: string) => /^[a-f0-9-]{36}$/.test(s) }))
vi.mock('@/lib/season-kickoff-server', () => ({ seasonPrivateHeaders: { 'Cache-Control': 'private, no-store' }, seasonToday: () => '2026-09-07',
  readSeasonScope: () => ({ team: 'Aces', league: '2027 Fall', flight: '4.0', seasonKey: 'season' }), authorizeSeason: mocked.authorize,
  loadSeasonFixtures: mocked.fixtures, loadSeasonRoster: mocked.roster, loadSeasonInvites: mocked.invites, loadSeasonResponses: mocked.replies, loadSeasonRecipient: mocked.recipient, loadSeasonSelf: mocked.self }))
import { GET as captainGet, POST as captainPost } from '@/app/api/captain/season-kickoff/route'
import { GET as playerGet, POST as playerPost } from '@/app/api/season-availability/[token]/route'
import { GET as calendarGet } from '@/app/api/season-availability/[token]/calendar.ics/route'

const match = { id: 'match-a', home_team: 'Aces', away_team: 'Volleys', match_date: '2026-09-14', match_time: '18:00:00' }
const context = { params: Promise.resolve({ token: 'personal-token' }) }
const answer = { matchId: 'match-a', matchDate: '2026-09-14', matchTime: '18:00:00', status: 'available' }
const request = (body: unknown) => new Request('https://example.test/api/season', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => {
  vi.resetAllMocks()
  mocked.auth.mockResolvedValue({ ok: true, userId: 'captain' }); mocked.authorize.mockResolvedValue(true)
  mocked.fixtures.mockResolvedValue([match]); mocked.roster.mockResolvedValue([{ key: 'p1', playerId: 'p1', name: 'Jordan' }])
  mocked.invites.mockResolvedValue([]); mocked.replies.mockResolvedValue([])
  mocked.self.mockResolvedValue({ key: 'p1', playerId: 'p1', name: 'Jordan' })
  mocked.recipient.mockResolvedValue({ playerName: 'Jordan', matches: [match], replies: [], today: '2026-09-07' })
  mocked.rpc.mockResolvedValue({ data: 1, error: null })
})
describe('captain season endpoints', () => {
  it('prepares only the authenticated captain’s own roster identity for self entry', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const query: Record<string, unknown> = {}
    for (const name of ['update', 'eq', 'in', 'is']) query[name] = vi.fn(() => query)
    query.then = (resolve: (value: unknown) => void) => resolve({ error: null })
    mocked.from.mockReturnValue({ ...query, upsert })
    expect((await captainPost(request({ action: 'self', playerKeys: ['victim'] }))).status).toBe(200)
    expect(upsert.mock.calls[0][0]).toEqual([expect.objectContaining({ roster_key: 'p1', player_id: 'p1', player_name: 'Jordan' })])
    expect(mocked.self).toHaveBeenCalledWith(expect.anything(), 'captain', expect.any(Array))
  })
  it('does not guess a personal roster identity from a name or posted player key', async () => {
    mocked.self.mockResolvedValue(null)
    expect((await captainPost(request({ action: 'self', playerKeys: ['p1'] }))).status).toBe(409)
    expect(mocked.from).not.toHaveBeenCalled()
  })
  it('requires authentication before accessing private data', async () => {
    mocked.auth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) })
    expect((await captainGet(new Request('https://example.test'))).status).toBe(401)
    expect(mocked.fixtures).not.toHaveBeenCalled()
  })
  it('requires a captain link for the exact team and season', async () => {
    mocked.authorize.mockResolvedValue(false)
    expect((await captainGet(new Request('https://example.test'))).status).toBe(403)
    expect(mocked.fixtures).not.toHaveBeenCalled()
  })
  it('does not create links for arbitrary player IDs', async () => {
    expect((await captainPost(request({ playerKeys: ['other-player'] }))).status).toBe(409)
    expect(mocked.from).not.toHaveBeenCalled()
  })
  it('returns explicit empty schedule and roster states without writing anything', async () => {
    mocked.fixtures.mockResolvedValue([]); mocked.roster.mockResolvedValue([])
    expect(await (await captainGet(new Request('https://example.test'))).json()).toMatchObject({ ok: true, matches: [], roster: [], readiness: [] })
    expect(mocked.from).not.toHaveBeenCalled()
  })
})
describe('personal season reply endpoint', () => {
  it('uses only the separate read-only token lookup for a calendar feed', async () => {
    mocked.recipient.mockResolvedValue({ scope: { team: 'Aces' }, playerName: 'Private player name', matches: [match], replies: [], today: '2026-09-07' })
    const result = await calendarGet(new Request('https://example.test'), context)
    const ics = await result.text()
    expect(mocked.recipient).toHaveBeenCalledWith(expect.anything(), 'personal-token', true)
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).not.toContain('Private player name')
    expect(mocked.rpc).not.toHaveBeenCalled()
  })
  it('accepts a no-login reply and ignores spoofed identity fields', async () => {
    const result = await playerPost(request({ playerId: 'victim', playerName: 'Someone else', responses: [answer] }), context)
    expect(result.status).toBe(200)
    expect(mocked.rpc).toHaveBeenCalledWith('save_season_availability', { p_token: 'personal-token', p_responses: [answer] })
    expect(mocked.auth).not.toHaveBeenCalled()
  })
  it.each([
    [{ ...answer, matchId: 'other-team-match' }], [{ ...answer, matchDate: '2026-09-15' }],
    [{ ...answer, matchTime: '19:00:00' }], [{ ...answer, status: 'confirmed' }], [answer, answer],
  ])('rejects foreign, stale, duplicated or invalid answers', async (...responses) => {
    expect((await playerPost(request({ responses }), context)).status).toBe(409)
    expect(mocked.rpc).not.toHaveBeenCalled()
  })
  it('rejects an empty save rather than treating unanswered dates as available', async () => {
    expect((await playerPost(request({ responses: [] }), context)).status).toBe(400)
  })
  it('blocks revoked or invalid personal links', async () => {
    mocked.recipient.mockResolvedValue(null)
    expect((await playerGet(new Request('https://example.test'), context)).status).toBe(404)
    expect((await playerPost(request({ responses: [answer] }), context)).status).toBe(404)
    expect(mocked.rpc).not.toHaveBeenCalled()
  })
  it('does not claim success when the database rejected a concurrent schedule change', async () => {
    mocked.rpc.mockResolvedValue({ error: { message: 'changed' } })
    expect((await playerPost(request({ responses: [answer] }), context)).status).toBe(409)
  })
})
