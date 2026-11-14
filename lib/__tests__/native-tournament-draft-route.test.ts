import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GET, POST } from '../../app/api/mobile/first-party/tournaments/draft/route'
import { GET as getDesk, PATCH as configure, POST as prepare } from '../../app/api/mobile/first-party/tournaments/desk/route'

const mocks = vi.hoisted(() => ({ verifiedAccount: vi.fn(), rpc: vi.fn() }))
vi.mock('../mobile-account-auth', async importOriginal => ({
  ...(await importOriginal<typeof import('../mobile-account-auth')>()),
  verifiedAccount: mocks.verifiedAccount,
  accountClient: () => ({ rpc: mocks.rpc }),
}))

const owner = '11111111-1111-4111-8111-111111111111'
const revision = '33333333-3333-4333-8333-333333333333'
const endpoint = 'https://example.test/api/mobile/first-party/tournaments/draft'
const deskEndpoint = 'https://example.test/api/mobile/first-party/tournaments/desk'
const draft = {
  name: 'Saturday Doubles', date: '2026-12-05', venue: 'Northside Tennis',
  division: 'Open Doubles', discipline: 'doubles', format: 'round_robin',
}
const write = (body: object) => new Request(endpoint, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only')
  mocks.verifiedAccount.mockResolvedValue({ user: { id: owner } })
  mocks.rpc.mockResolvedValue({ data: { draft, revision }, error: null })
})

afterEach(() => vi.unstubAllEnvs())

it('reads only the verified account and never caches the response', async () => {
  expect((await GET(new Request(endpoint + '?owner=someone-else'))).status).toBe(400)
  expect(mocks.rpc).not.toHaveBeenCalled()
  const response = await GET(new Request(endpoint))
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ ok: true, scope: 'first-party', owner, saved: { draft, revision } })
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('native_tournament_draft', { p_owner: owner })
})

it('rejects owner overrides and invalid dates before saving under the verified account', async () => {
  expect((await POST(write({ draft, revision, expected: null, owner: 'someone-else' }))).status).toBe(400)
  expect((await POST(write({ draft: { ...draft, date: '2026-02-30' }, revision, expected: null }))).status).toBe(400)
  expect(mocks.rpc).not.toHaveBeenCalled()
  expect((await POST(write({ draft, revision, expected: null }))).status).toBe(200)
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('save_native_tournament_draft', {
    p_owner: owner, p_expected: null, p_revision: revision, p_draft: draft,
  })
})

it('requires sign-in and returns a conflict when an edit used an old draft', async () => {
  mocks.verifiedAccount.mockResolvedValueOnce(null)
  expect((await POST(write({ draft, revision, expected: null }))).status).toBe(401)
  expect(mocks.rpc).not.toHaveBeenCalled()
  mocks.rpc.mockResolvedValueOnce({ data: { code: 'stale' }, error: null })
  const response = await POST(write({ draft, revision, expected: null }))
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ ok: false, scope: 'first-party', code: 'stale' })
})

it('opens the desk and prepares only a saved revision owned by the signed-in account', async () => {
  expect((await getDesk(new Request(deskEndpoint + '?owner=foreign'))).status).toBe(400)
  mocks.verifiedAccount.mockResolvedValueOnce(null)
  expect((await getDesk(new Request(deskEndpoint))).status).toBe(401)
  expect(mocks.rpc).not.toHaveBeenCalled()
  mocks.rpc.mockResolvedValueOnce({ data: [{ draft, revision }], error: null })
  const list = await getDesk(new Request(deskEndpoint + '?after=' + revision))
  expect(await list.json()).toEqual({ ok: true, owner, scope: 'first-party', events: [{ draft, revision }], next: null })
  expect(mocks.rpc).toHaveBeenCalledWith('native_tournament_desk', { p_owner: owner, p_after: revision })
  const request = (input: object) => new Request(deskEndpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  expect((await prepare(request({ revision, owner: 'foreign' }))).status).toBe(400)
  expect(await (await prepare(request({ revision }))).json()).toEqual({
    ok: true, scope: 'first-party', owner, event: { draft, revision },
  })
  expect(mocks.rpc).toHaveBeenLastCalledWith('prepare_native_tournament', { p_owner: owner, p_revision: revision })
})

it('provides the current revision after a draft has moved to Tournament Desk', async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { draft: null, revision }, error: null })
  expect(await (await GET(new Request(endpoint))).json()).toEqual({
    ok: true, scope: 'first-party', owner, saved: null, expected: revision,
  })
})

it('validates division settings and reads or writes only the signed-in organizer’s setup', async () => {
  const division = { id: revision, name: 'Open Doubles', discipline: 'doubles', format: 'round_robin' }
  const settings = { registrationClosesOn: '2026-12-03', timeZone: 'America/Chicago', divisions: [division] }
  const next = '44444444-4444-4444-8444-444444444444'
  const payload = { event: revision, expected: null, revision: next, settings }
  const request = (input: object) => new Request(deskEndpoint, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  expect((await configure(request({ ...payload, owner: 'someone-else' }))).status).toBe(400)
  expect((await configure(request({ ...payload, settings: { ...settings, timeZone: 'Invalid/City' } }))).status).toBe(400)
  expect((await configure(request({ ...payload, settings: { ...settings, divisions: [] } }))).status).toBe(400)
  expect((await configure(request({ ...payload, settings: { ...settings, divisions: [
    division, { ...division, id: next, name: ' open   DOUBLES ' },
  ] } }))).status).toBe(400)
  expect(mocks.rpc).not.toHaveBeenCalled()
  const setup = { draft, revision, settings, settingsRevision: next }
  mocks.rpc.mockResolvedValueOnce({ data: setup, error: null })
  expect(await (await configure(request(payload))).json()).toMatchObject({ ok: true, owner, setup })
  expect(mocks.rpc).toHaveBeenLastCalledWith('save_native_tournament_settings', {
    p_owner: owner, p_event: revision, p_expected: null, p_revision: next, p_settings: settings,
  })
  mocks.rpc.mockResolvedValueOnce({ data: setup, error: null })
  expect(await (await getDesk(new Request(deskEndpoint + '?event=' + revision))).json()).toMatchObject({ ok: true, setup })
  expect(mocks.rpc).toHaveBeenLastCalledWith('native_tournament_setup', { p_owner: owner, p_event: revision })
  mocks.rpc.mockResolvedValueOnce({ data: { code: 'stale' }, error: null })
  expect((await configure(request(payload))).status).toBe(409)
})
