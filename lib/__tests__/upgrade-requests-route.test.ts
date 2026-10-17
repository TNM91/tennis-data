import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  existing: null as Record<string, unknown> | null,
  inserted: null as Record<string, unknown> | null,
  conflictRow: null as Record<string, unknown> | null,
  filters: [] as Array<[string, unknown]>,
  lookups: 0,
}))

vi.mock('@/lib/paid-checkout', () => ({ PAID_CHECKOUT_ENABLED: false }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, _key: string, options: { global?: unknown }) => options.global
    ? { auth: { getUser: async () => ({ data: { user: { id: 'member-1', email: 'member@example.com' } }, error: null }) } }
    : {
        from: (table: string) => {
          if (table !== 'upgrade_requests') throw new Error(`Unexpected table: ${table}`)
          const query = {
            select() { return query },
            eq(field: string, value: unknown) { state.filters.push([field, value]); return query },
            in(field: string, value: unknown) { state.filters.push([field, value]); return query },
            order() { return query },
            limit() { return query },
            async maybeSingle() { state.lookups += 1; return { data: state.existing, error: null } },
            insert(payload: Record<string, unknown>) {
              state.inserted = payload
              return { select: () => ({ single: async () => {
                if (state.conflictRow) {
                  state.existing = state.conflictRow
                  return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "upgrade_requests_active_dedupe_idx"' } }
                }
                return { data: { ...payload, id: 'new-request', status: 'pending', created_at: '2026-09-21T10:00:00Z', updated_at: '2026-09-21T10:00:00Z' }, error: null }
              } }) }
            },
          }
          return query
        },
      },
}))

const body = {
  planId: 'player_plus',
  email: 'member@example.com',
  goal: 'Follow Alex Qin in My Lab.',
  nextHref: '/players/alex',
}

function request(signedIn = true) {
  return new Request('https://tenaceiq.test/api/upgrade-requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(signedIn ? { authorization: 'Bearer test-token' } : {}) },
    body: JSON.stringify(body),
  })
}

describe('paused upgrade request capture', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
    state.existing = null
    state.inserted = null
    state.conflictRow = null
    state.filters = []
    state.lookups = 0
  })

  afterEach(() => vi.unstubAllEnvs())

  it('resumes a matching signed-in request instead of inserting another', async () => {
    state.existing = {
      id: 'saved-request', plan_id: 'player_plus', plan_name: 'Player', requester_name: '',
      requester_email: 'member@example.com', requester_user_id: 'member-1', organization: 'Alex Qin',
      goal: body.goal, next_href: body.nextHref, status: 'pending', source: 'upgrade_page',
      created_at: '2026-09-21T09:00:00Z', updated_at: '2026-09-21T09:00:00Z',
    }
    const { POST } = await import('../../app/api/upgrade-requests/route')
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, alreadyRequested: true, request: { id: 'saved-request' } })
    expect(state.inserted).toBeNull()
    expect(state.filters).toContainEqual(['requester_user_id', 'member-1'])
    expect(state.filters).toContainEqual(['plan_id', 'player_plus'])
    expect(state.filters).toContainEqual(['next_href', '/players/alex'])
    expect(state.filters).toContainEqual(['status', ['pending', 'contacted']])
  })

  it('creates a first request and keeps public submissions separate', async () => {
    const { POST } = await import('../../app/api/upgrade-requests/route')
    expect((await POST(request())).status).toBe(200)
    expect(state.inserted).toMatchObject({ requester_user_id: 'member-1', plan_id: 'player_plus', next_href: '/players/alex', dedupe_active: true })
    expect(state.lookups).toBe(1)

    state.inserted = null
    state.lookups = 0
    expect((await POST(request(false))).status).toBe(200)
    expect(state.inserted).toMatchObject({ requester_user_id: null, plan_id: 'player_plus' })
    expect(state.lookups).toBe(0)
  })

  it('returns the winning request when another tab inserts it first', async () => {
    state.conflictRow = {
      id: 'winning-request', plan_id: 'player_plus', plan_name: 'Player', requester_name: '',
      requester_email: 'member@example.com', requester_user_id: 'member-1', organization: 'Alex Qin',
      goal: body.goal, next_href: body.nextHref, status: 'pending', source: 'upgrade_page',
      created_at: '2026-09-21T10:00:00Z', updated_at: '2026-09-21T10:00:00Z',
    }
    const { POST } = await import('../../app/api/upgrade-requests/route')
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, alreadyRequested: true, request: { id: 'winning-request' } })
    expect(state.lookups).toBe(2)
  })
})
