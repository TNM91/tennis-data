import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('../supabase', () => ({ supabaseUrl: 'https://example.supabase.co', supabaseKey: 'test' }))
vi.mock('../captain-availability-request-server', () => ({
  isUuid: (value: string) => value === '11111111-1111-4111-8111-111111111111',
  getCaptainAvailabilityServiceClient: () => ({ from: mocks.from }),
}))
import { GET, POST } from '../../app/api/leagues/weekly/sessions/[sessionId]/communications/route'

const params = Promise.resolve({ sessionId: '11111111-1111-4111-8111-111111111111' })
function request(token = 'valid') {
  return new Request('https://example.test/api', { method: 'POST', headers: token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : {}, body: JSON.stringify({ kind: 'courts', message: 'Courts are ready.' }) })
}
function query(data: unknown) {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data, error: null }) }
  return chain
}

describe('weekly communication authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'stranger' } }, error: null })
    mocks.from.mockImplementation((table) => table === 'tiq_league_weekly_sessions'
      ? query({ id: 'week', league_id: 'league', status: 'collecting' })
      : table === 'tiq_leagues' ? query({ league_name: 'STL', created_by_user_id: 'owner' }) : query(null))
  })
  it('rejects unauthenticated requests without touching the database', async () => {
    expect((await POST(request(''), { params })).status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('does not let another signed-in player send or inspect league updates', async () => {
    expect((await POST(request(), { params })).status).toBe(403)
    expect((await GET(request(), { params })).status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalledWith('internal_notifications')
  })
  it('requires a published court plan even for the owner', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
    const response = await POST(request(), { params })
    expect(response.status).toBe(409)
    expect((await response.json()).message).toContain('Publish')
    expect(mocks.from).not.toHaveBeenCalledWith('internal_notifications')
  })
})
