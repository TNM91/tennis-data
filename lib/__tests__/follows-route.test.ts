import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  allowed: true,
  filters: [] as Array<[string, unknown]>,
  inserted: null as Record<string, unknown> | null,
  deleted: false,
}))

vi.mock('@/lib/player-api-auth', () => ({
  getPlayerApiAuth: vi.fn(async () => state.allowed
    ? { ok: true, userId: 'member-1' }
    : { ok: false, response: Response.json({ ok: false }, { status: 403 }) }),
  getSignedInPlayerApiAuth: vi.fn(async () => ({ ok: true, userId: 'member-1' })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'user_follows') throw new Error(`Unexpected table: ${table}`)
      const query = {
        select() { return query },
        eq(field: string, value: unknown) { state.filters.push([field, value]); return query },
        limit() { return query },
        async insert(payload: Record<string, unknown>) { state.inserted = payload; return { error: null } },
        delete() { state.deleted = true; return query },
        then(resolve: (value: { data: unknown[]; error: null }) => unknown) { return Promise.resolve({ data: [], error: null }).then(resolve) },
      }
      return query
    },
  }),
}))

const item = { entity_type: 'player', entity_id: 'player-2', entity_name: 'Jordan', subtitle: null }
const request = (method: string, body: Record<string, unknown> = item) => new Request('https://tenaceiq.com/api/follows', {
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

describe('follows route', () => {
  beforeEach(() => {
    state.allowed = true
    state.filters = []
    state.inserted = null
    state.deleted = false
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  })

  it('blocks adding follows without Player access', async () => {
    state.allowed = false
    const { POST } = await import('../../app/api/follows/route')
    expect((await POST(request('POST'))).status).toBe(403)
    expect(state.inserted).toBeNull()
  })

  it('binds a new follow to the authenticated member', async () => {
    const { POST } = await import('../../app/api/follows/route')
    expect((await POST(request('POST', { ...item, user_id: 'someone-else' }))).status).toBe(201)
    expect(state.inserted).toMatchObject({ ...item, user_id: 'member-1' })
  })

  it('lets a signed in former member remove only their own follow', async () => {
    state.allowed = false
    const { DELETE } = await import('../../app/api/follows/route')
    expect((await DELETE(request('DELETE'))).status).toBe(200)
    expect(state.deleted).toBe(true)
    expect(state.filters).toContainEqual(['user_id', 'member-1'])
    expect(state.filters).toContainEqual(['entity_id', 'player-2'])
  })

  it('rejects malformed follow records', async () => {
    const { POST } = await import('../../app/api/follows/route')
    expect((await POST(request('POST', { ...item, entity_type: 'other' }))).status).toBe(400)
    expect(state.inserted).toBeNull()
  })
})
