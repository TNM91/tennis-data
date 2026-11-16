import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GET as getLeague, POST as postLeague } from '../../app/api/mobile/first-party/leagues/publish/route'
import { GET as getTournament, POST as postTournament } from '../../app/api/mobile/first-party/tournaments/publish/route'

const mocks = vi.hoisted(() => ({ configuration: vi.fn(), rpc: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('../apple-purchase-server', () => ({ applePurchaseConfiguration: mocks.configuration }))
vi.mock('../mobile-account-auth', async importOriginal => ({
  ...(await importOriginal<typeof import('../mobile-account-auth')>()),
  verifiedAccount: async () => ({ user: { id: owner } }),
  accountClient: () => ({ rpc: mocks.rpc }),
}))

const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const draft = '33333333-3333-4333-8333-333333333333'
const token = '44444444-4444-4444-8444-444444444444'
const cancelKey = '55555555-5555-4555-8555-555555555555'

const publishing = [
  { name: 'league', query: 'draft', get: getLeague, post: postLeague },
  { name: 'tournament', query: 'event', get: getTournament, post: postTournament },
] as const

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only')
  vi.stubEnv('APPLE_LEAGUE_PURCHASES_ENABLED', undefined)
  vi.stubEnv('APPLE_TOURNAMENT_PURCHASES_ENABLED', undefined)
  vi.stubEnv('APPLE_LEAGUE_SANDBOX_CHECKOUT_ENABLED', undefined)
  mocks.configuration.mockReset().mockReturnValue({ mode: 'sandbox', environment: 'Sandbox' })
  mocks.rpc.mockReset()
})

afterEach(() => vi.unstubAllEnvs())

function endpoint(publish: typeof publishing[number]) {
  return new URL('https://example.test/api/mobile/first-party/' + publish.name +
    's/publish?' + new URLSearchParams({ [publish.query]: draft }))
}

function prepare(url: URL) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'prepare', expected: draft, token, cancelKey }),
  })
}

it.each(publishing)('allows $name checkout in sandbox mode for an allowlisted owner without live flags', async publish => {
  mocks.rpc
    .mockResolvedValueOnce({ data: { ownerId: owner, sandboxEnabled: true } })
    .mockResolvedValueOnce({ data: { state: 'ready' } })
    .mockResolvedValueOnce({ data: { ownerId: owner, sandboxEnabled: true } })
    .mockResolvedValueOnce({ data: { state: 'pending', token, start: true } })

  const url = endpoint(publish)
  const status = await publish.get(new Request(url))
  const start = await publish.post(prepare(url))

  expect(status.status).toBe(200)
  expect(await status.json()).toMatchObject({ environment: 'Sandbox', available: true, checkout: { state: 'ready' } })
  expect(start.status).toBe(200)
  expect(await start.json()).toMatchObject({ environment: 'Sandbox', checkout: { state: 'pending', token } })
  expect(mocks.rpc).toHaveBeenLastCalledWith('native_' + publish.name + '_checkout', expect.objectContaining({
    p_owner: owner, p_environment: 'Sandbox', p_action: 'prepare', p_token: token, p_cancel_key: cancelKey,
  }))
})

it.each(publishing)('denies $name checkout when the sandbox grant belongs to another account', async publish => {
  mocks.rpc.mockResolvedValue({ data: { ownerId: other, sandboxEnabled: true } })
  const url = endpoint(publish)
  const status = await publish.get(new Request(url))
  const start = await publish.post(prepare(url))

  expect(await status.json()).toMatchObject({ available: false })
  expect(await start.json()).toMatchObject({ available: false })
  expect(mocks.rpc.mock.calls).toEqual([
    ['apple_purchase_account', { p_owner: owner }],
    ['apple_purchase_account', { p_owner: owner }],
  ])
})

it.each(publishing)('does not start a live $name checkout when its production flag is unset', async publish => {
  mocks.configuration.mockReturnValue({ mode: 'production', environment: 'Production' })
  mocks.rpc.mockResolvedValue({ data: { ownerId: owner, sandboxEnabled: false } })
  const start = await publish.post(prepare(endpoint(publish)))

  expect(start.ok ? await start.json() : start.status).toEqual(
    publish.name === 'league' ? 403 : expect.objectContaining({ available: false }),
  )
  expect(mocks.rpc.mock.calls.every(([procedure]) => procedure === 'apple_purchase_account')).toBe(true)
})

it('honors an explicit league sandbox pause even in global sandbox mode', async () => {
  vi.stubEnv('APPLE_LEAGUE_SANDBOX_CHECKOUT_ENABLED', 'false')
  mocks.rpc.mockResolvedValue({ data: { ownerId: owner, sandboxEnabled: true } })
  const start = await postLeague(prepare(endpoint(publishing[0])))

  expect(start.status).toBe(403)
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('apple_purchase_account', { p_owner: owner })
})
