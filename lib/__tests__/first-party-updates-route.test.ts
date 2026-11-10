import { createClient } from '@supabase/supabase-js'
import { beforeEach, expect, it, vi } from 'vitest'
import { GET, POST } from '../../app/api/mobile/first-party/updates/route'

const { auth, connect } = vi.hoisted(() => ({ auth: vi.fn(), connect: vi.fn() }))
vi.mock('@/lib/mobile-account-auth', async original => ({
  ...await original<typeof import('@/lib/mobile-account-auth')>(), verifiedAccount: auth, accountClient: connect,
}))

const owner = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
const createdAt = '2026-11-10T01:02:03.123456+00:00'
const base = 'https://example.test/api/mobile/first-party/updates'
const write = (body: object) => new Request(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const calls: { url: URL; method: string; body: string }[] = []
let rpcResult: Response

beforeEach(() => {
  vi.resetAllMocks()
  calls.length = 0
  auth.mockResolvedValue({ user: { id: owner }, token: 'verified-token' })
  rpcResult = Response.json([{ id, recipient_profile_id: owner, read_at: createdAt }])
  connect.mockReturnValue(createClient('https://updates.example.test', 'synthetic-anon', { auth: { persistSession: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input)), method = init?.method || 'GET'
    calls.push({ url, method, body: String(init?.body || '') })
    if (url.pathname.includes('/rpc/')) return rpcResult
    return method === 'HEAD' ? new Response(null, { headers: { 'Content-Range': '0-0/1' } }) : Response.json([{ id, recipient_profile_id: owner }])
  } } }))
})

it('requires a verified account and rejects invalid cursors before reading rows', async () => {
  auth.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
  expect((await GET(new Request(base))).status).toBe(401)
  expect((await POST(write({ ids: [id] }))).status).toBe(401)
  for (const query of ['?owner=other', '?op=count&unread=1', '?unread=1&unread=0', '?category=system', '?before=2026-11-10', '?before='+encodeURIComponent('now),id.neq.x')+'&id='+id]) {
    expect((await GET(new Request(base+query))).status).toBe(400)
  }
  expect(calls).toEqual([])
})

it('applies count and keyset pagination to the same private projection', async () => {
  const page = await GET(new Request(base+'?'+new URLSearchParams({ unread: '1', category: 'other', before: createdAt, id })))
  expect(page.headers.get('cache-control')).toBe('private, no-store')
  expect(await page.json()).toEqual({ ok: true, owner, releaseScope: 'first-party', rows: [{ id, recipient_profile_id: owner }] })
  const count = await GET(new Request(base+'?op=count'))
  expect(await count.json()).toMatchObject({ ok: true, owner, releaseScope: 'first-party', count: 1 })
  expect(calls.map(call => [call.method, call.url.pathname, call.url.searchParams.get('recipient_profile_id')])).toEqual([
    ['GET', '/rest/v1/native_first_party_updates', 'eq.'+owner], ['HEAD', '/rest/v1/native_first_party_updates', 'eq.'+owner],
  ])
  expect(calls[0].url.searchParams.get('or')).toContain(createdAt)
  expect(calls[0].url.searchParams.get('limit')).toBe('26')
  expect(calls[0].url.searchParams.get('notification_type')).toBe('in.(support,system)')
  expect(calls[1].url.searchParams.get('read_at')).toBe('is.null')
})

it('only invokes the scoped read action with reviewed IDs and confirms its receipt', async () => {
  expect((await POST(write({ ids: [id, id.toUpperCase()] }))).status).toBe(400)
  expect((await POST(write({ ids: [id], owner }))).status).toBe(400)
  expect(calls).toEqual([])
  expect(await (await POST(write({ ids: [id] }))).json()).toMatchObject({ ok: true, owner, releaseScope: 'first-party', rows: [{ id, read_at: createdAt }] })
  expect(calls[0].url.pathname).toBe('/rest/v1/rpc/native_first_party_mark_updates_read')
  expect(JSON.parse(calls[0].body)).toEqual({ p_ids: [id] })
  rpcResult = Response.json({ code: 'P0001', message: 'Database details' }, { status: 400 })
  const denied = await POST(write({ ids: [id] }))
  expect(denied.status).toBe(409)
  expect(await denied.json()).toEqual({ ok: false, releaseScope: 'first-party' })
})
