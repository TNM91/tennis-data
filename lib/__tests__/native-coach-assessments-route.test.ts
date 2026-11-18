import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GET, POST } from '../../app/api/mobile/coach/assessments/route'

const mocks = vi.hoisted(() => ({ coach: vi.fn(), account: vi.fn(), rpc: vi.fn() }))
vi.mock('../coach-api-auth', () => ({ getCoachApiAuth: mocks.coach }))
vi.mock('../mobile-account-auth', async importOriginal => ({
  ...await importOriginal<typeof import('../mobile-account-auth')>(),
  verifiedAccount: mocks.account,
  accountClient: () => ({ rpc: mocks.rpc }),
}))

const coach = '11111111-1111-4111-8111-111111111111'
const player = '22222222-2222-4222-8222-222222222222'
const draft = {
  id: '33333333-3333-4333-8333-333333333333', student: 'student-one', linkUpdatedAt: '2026-11-17T12:00:00.123456+00:00',
  observation: { context: 'drill', focus: 'serve', skills: { serve: 1 }, note: 'Call the target sooner.' },
}
const endpoint = 'https://example.test/api/mobile/coach/assessments'
const post = (value: unknown) => new Request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic')
  mocks.coach.mockReset().mockResolvedValue({ ok: true, userId: coach })
  mocks.account.mockReset().mockResolvedValue({ user: { id: player } })
  mocks.rpc.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

it('uses the verified player identity for private My Lab reads and rejects identity injection', async () => {
  mocks.rpc.mockResolvedValue({ data: [], error: null })
  const response = await GET(new Request(endpoint))
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(await response.json()).toMatchObject({ owner: player, student: null, assessments: [] })
  expect(mocks.rpc).toHaveBeenCalledWith('native_coach_assessments', { p_owner: player, p_student: null })
  expect((await GET(new Request(endpoint + '?owner=' + coach))).status).toBe(400)
  expect(mocks.rpc).toHaveBeenCalledTimes(1)
})

it('checks coach access, validates observations, and sends only authenticated ownership to the database', async () => {
  mocks.coach.mockResolvedValueOnce({ ok: false, response: new Response(null, { status: 403 }) })
  expect((await POST(post(draft))).status).toBe(403)
  expect((await POST(post({ ...draft, observation: { ...draft.observation, skills: { serve: 4 } } }))).status).toBe(400)
  expect((await POST(post({ ...draft, observation: { ...draft.observation, focus: 'net' } }))).status).toBe(400)
  expect(mocks.rpc).not.toHaveBeenCalled()

  mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null })
  expect((await POST(post({ ...draft, owner: player }))).status).toBe(200)
  expect(mocks.rpc).toHaveBeenCalledWith('share_native_coach_assessment', {
    p_owner: coach, p_student: draft.student, p_id: draft.id, p_link_updated_at: draft.linkUpdatedAt, p_observation: draft.observation,
  })
  expect((await POST(post(draft))).status).toBe(409)
})
