import { beforeEach, expect, it, vi } from 'vitest'
import { GET, POST } from '../../app/api/mobile/first-party/competitions/schedule/route'

const { signedIn, access, scope, review, save } = vi.hoisted(() => ({
  signedIn: vi.fn(), access: vi.fn(), scope: vi.fn(), review: vi.fn(), save: vi.fn(),
}))
vi.mock('../player-api-auth', () => ({ getSignedInPlayerApiAuth: signedIn, loadPlayerAccess: access }))
vi.mock('../native-competitions', () => ({ reviewedSchedulingLeague: scope }))
vi.mock('../native-league-schedule', () => ({ loadLeagueScheduling: review, saveLeagueScheduling: save }))

const url = 'https://example.test/api/mobile/first-party/competitions/schedule'
const id = (n: number) => '11111111-1111-4111-8111-00000000000' + n
const league = { id: 'demo', name: 'City League', startsOn: '2026-10-01', endsOn: '2026-12-01', timeZone: 'America/Chicago' }
const change = { leagueId: 'demo', requestId: id(1), matchId: null, version: '', a: id(2), b: id(3),
  date: '2026-11-21', time: '18:00', venueId: id(4), court: 'Court 4', duration: 90, notify: true }
const post = (value: object) => new Request(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
})

beforeEach(() => {
  vi.resetAllMocks()
  signedIn.mockResolvedValue({ ok: true, userId: 'owner', supabase: {} })
  access.mockResolvedValue({ canUseLeagueTools: true })
  scope.mockResolvedValue(league)
})

it('checks entitlement and exact league ownership before loading any roster or saving a match', async () => {
  signedIn.mockResolvedValueOnce({ ok: false, response: new Response(null, { status: 401 }) })
  expect((await GET(new Request(url + '?league=demo'))).status).toBe(401)
  access.mockResolvedValueOnce({ canUseLeagueTools: false })
  expect((await POST(post(change))).status).toBe(403)
  expect(scope).not.toHaveBeenCalled()
  scope.mockResolvedValueOnce(null)
  expect((await POST(post(change))).status).toBe(403)
  expect(review).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
})

it('rejects recipients supplied by the caller and returns overlap or a scoped save receipt', async () => {
  expect((await POST(post({ ...change, recipient: id(5) }))).status).toBe(400)
  expect(save).not.toHaveBeenCalled()
  save.mockResolvedValueOnce({ code: 'overlap' })
  expect((await POST(post(change))).status).toBe(409)
  save.mockResolvedValueOnce({ code: 'saved', notified: 1, unreachable: 1, match: {
    id: id(5), a: 'Alex', b: 'Drew', date: change.date, time: change.time, facility: 'Court Club · Court 4',
    court: '4', status: 'coordinator_set', duration: 90,
  } })
  const response = await POST(post(change))
  expect(save).toHaveBeenLastCalledWith('owner', league, { ...change, court: '4' })
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toMatchObject({ ok: true, owner: 'owner', leagueId: 'demo', releaseScope: 'first-party',
    requestId: change.requestId, notified: 1, unreachable: 1 })
})
