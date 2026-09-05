import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), service: vi.fn() }))
vi.mock('@/lib/captain-api-auth', () => ({ getCaptainApiAuth: mocks.auth }))
vi.mock('@/lib/captain-availability-request-server', () => ({
  getCaptainAvailabilityServiceClient: mocks.service,
  isUuid: (value: string) => /^[0-9a-f-]{36}$/i.test(value),
}))
import { GET } from '@/app/api/captain/quick-start/route'

type Result = { data?: unknown; error?: unknown; count?: number }
function database(results: Record<string, Result[]>) {
  const queries: Array<{ table: string; calls: Array<[string, unknown[]]> }> = []
  return { queries, from: vi.fn((table: string) => {
    const result = results[table]?.shift() || { data: null }
    const record = { table, calls: [] as Array<[string, unknown[]]> }
    queries.push(record)
    const query: Record<string, unknown> = { then: (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve) }
    for (const method of ['select', 'eq', 'neq', 'is', 'contains', 'or', 'order', 'limit', 'maybeSingle']) query[method] = (...args: unknown[]) => { record.calls.push([method, args]); return query }
    return query
  }) }
}
const connectionId = '12345678-1234-4123-8123-123456789012'
const request = () => new Request(`https://example.test/api/captain/quick-start?connection=${connectionId}`)
const link = { team_name: 'Our team', league_name: 'Our league', flight: '4.0', team_roles: ['captain'] }
const fullSlots = [{ slotType: 'doubles', players: [{ playerId: 'a', playerName: 'A' }, { playerId: 'b', playerName: 'B' }] }]

beforeEach(() => vi.resetAllMocks())
describe('Captain quick start API', () => {
  it('requires authentication before reading private progress', async () => {
    mocks.auth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) })
    expect((await GET(request())).status).toBe(401)
    expect(mocks.service).not.toHaveBeenCalled()
  })
  it.each([null, { ...link, team_roles: ['player'] }])('rejects absent or noncaptain owned links', async (data) => {
    const service = database({ team_profile_links: [{ data }] })
    mocks.service.mockReturnValue(service)
    mocks.auth.mockResolvedValue({ ok: true, userId: 'owner', supabase: database({}) })
    expect((await GET(request())).status).toBe(403)
    expect(service.queries).toHaveLength(1)
    expect(service.queries[0].calls).toContainEqual(['eq', ['profile_user_id', 'owner']])
    expect(service.queries[0].calls).toContainEqual(['eq', ['status', 'accepted']])
    expect(service.queries[0].calls).toContainEqual(['is', ['archived_at', null]])
  })
  it('reads saved data without creating invites, rooms, or completion flags', async () => {
    const service = database({ team_profile_links: [{ data: link }, { count: 1 }], internal_conversations: [{ data: null }] })
    const caller = database({ lineup_scenarios: [{ data: [{ id: 'saved', slots_json: fullSlots, match_date: '2026-09-14', opponent_team: 'Opponent' }] }] })
    mocks.service.mockReturnValue(service)
    mocks.auth.mockResolvedValue({ ok: true, userId: 'owner', supabase: caller })
    const response = await GET(request())
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ teammateConnected: true, lineupSaved: true, lineupSent: false, match: { date: '2026-09-14', opponent: 'Opponent', scenarioId: 'saved' } })
    for (const query of [service.queries[1], caller.queries[0]]) {
      expect(query.calls).toContainEqual(['eq', ['team_name', 'Our team']])
      expect(query.calls).toContainEqual(['eq', ['league_name', 'Our league']])
      expect(query.calls).toContainEqual(['eq', ['flight', '4.0']])
    }
  })
  it('does not turn failed queries into zero progress', async () => {
    mocks.service.mockReturnValue(database({ team_profile_links: [{ data: link }, { error: { message: 'offline' } }] }))
    mocks.auth.mockResolvedValue({ ok: true, userId: 'owner', supabase: database({ lineup_scenarios: [{ data: [] }] }) })
    expect((await GET(request())).status).toBe(503)
  })
  it('only counts a final announcement matched to its saved send receipt', async () => {
    const service = database({
      team_profile_links: [{ data: link }, { count: 1 }], internal_conversations: [{ data: { id: 'room' } }],
      internal_messages: [{ data: { id: 'announcement', metadata: { sourceMessageId: connectionId } } }, { data: { metadata: { matchDate: '2026-09-14', opponent: 'Opponent', finalLineup: { lineupId: 'final', sourceMessageId: connectionId, announcementMessageId: 'announcement', sentAt: '2026-09-04', sentByUserId: 'owner' } } } }],
    })
    mocks.service.mockReturnValue(service)
    mocks.auth.mockResolvedValue({ ok: true, userId: 'owner', supabase: database({ lineup_scenarios: [{ data: [] }] }) })
    expect(await (await GET(request())).json()).toMatchObject({ lineupSaved: true, lineupSent: true })
    expect(service.queries.find((query) => query.table === 'internal_messages')?.calls).toContainEqual(['or', ['metadata->>finalLineupAnnouncement.eq.true,metadata->>finalLineupChangeAnnouncement.eq.true']])
  })
  it('respects explicit removal from Team Chat', async () => {
    const service = database({ team_profile_links: [{ data: link }, { count: 1 }], internal_conversations: [{ data: { id: 'room' } }], team_room_member_removals: [{ data: { profile_id: 'owner' } }] })
    mocks.service.mockReturnValue(service)
    mocks.auth.mockResolvedValue({ ok: true, userId: 'owner', supabase: database({ lineup_scenarios: [{ data: [] }] }) })
    expect((await GET(request())).status).toBe(403)
    expect(service.queries.some((query) => query.table === 'internal_messages')).toBe(false)
  })
})
