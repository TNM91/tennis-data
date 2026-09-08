import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ auth: vi.fn(), authorize: vi.fn(), roster: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/captain-api-auth', () => ({ getCaptainApiAuth: mock.auth }))
vi.mock('@/lib/captain-availability-request-server', () => ({
  cleanAvailabilityText: (value: unknown, limit = 500) => typeof value === 'string' ? value.trim().slice(0, limit) : '',
  getCaptainAvailabilityServiceClient: () => ({ from: mock.from }),
  isUuid: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
}))
vi.mock('@/lib/season-kickoff-server', () => ({
  authorizeSeason: mock.authorize,
  loadSeasonRoster: mock.roster,
  seasonPrivateHeaders: { 'Cache-Control': 'private, no-store' },
}))

import { GET, POST } from '@/app/api/captain/weekly-availability/route'

const playerId = '11111111-1111-4111-8111-111111111111'
const path = 'https://example.test/api/captain/weekly-availability?team=Aces&league=Fall+2027&flight=4.0&matchDate=2026-09-14'
let savedRows: Array<Record<string, unknown>>
let upserted: Record<string, unknown> | null
let deleted: boolean

beforeEach(() => {
  vi.resetAllMocks()
  savedRows = []
  upserted = null
  deleted = false
  mock.auth.mockResolvedValue({ ok: true, userId: 'captain' })
  mock.authorize.mockResolvedValue(true)
  mock.roster.mockResolvedValue([{ key: playerId, playerId, name: 'Sam Edwards' }])
  mock.from.mockImplementation(() => {
    let operation = 'select'
    const query: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of ['select', 'eq', 'in', 'limit']) query[method] = vi.fn(() => query)
    query.upsert = vi.fn((row: Record<string, unknown>) => { operation = 'upsert'; upserted = row; return query })
    query.delete = vi.fn(() => { operation = 'delete'; deleted = true; return query })
    query.then = vi.fn((resolve) => resolve(operation === 'select' ? { data: savedRows, error: null } : { data: null, error: null }))
    return query
  })
})

describe('captain weekly availability API', () => {
  it('fails closed before reading private team availability', async () => {
    mock.auth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) })
    expect((await GET(new Request(path))).status).toBe(401)
    expect(mock.from).not.toHaveBeenCalled()

    mock.auth.mockResolvedValue({ ok: true, userId: 'captain' })
    mock.authorize.mockResolvedValue(false)
    expect((await GET(new Request(path))).status).toBe(403)
    expect(mock.roster).not.toHaveBeenCalled()
  })

  it('joins cloud rows to the scoped roster without exposing other players', async () => {
    savedRows = [{ player_id: playerId, status: 'limited', notes: 'Captain note', updated_at: '2026-09-08T18:00:00.000Z' }]
    const response = await GET(new Request(path))
    const body = await response.json()

    expect(body.availability).toEqual([expect.objectContaining({ playerName: 'Sam Edwards', status: 'tentative' })])
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mock.authorize).toHaveBeenCalledWith(expect.anything(), 'captain', expect.objectContaining({ team: 'Aces', league: 'Fall 2027', flight: '4.0' }))
  })

  it('stores captain changes in shared match availability', async () => {
    const response = await POST(new Request('https://example.test/api/captain/weekly-availability', {
      method: 'POST',
      body: JSON.stringify({ team: 'Aces', league: 'Fall 2027', flight: '4.0', matchDate: '2026-09-14', playerName: 'Sam Edwards', status: 'tentative', updatedAt: '2026-09-08T18:00:00.000Z' }),
    }))

    expect(response.status).toBe(200)
    expect(upserted).toMatchObject({ player_id: playerId, status: 'limited', team_name: 'Aces', match_date: '2026-09-14' })
  })

  it('preserves a newer cloud response from another device', async () => {
    savedRows = [{ player_id: playerId, status: 'available', notes: 'Newer reply', updated_at: '2026-09-08T19:00:00.000Z' }]
    const response = await POST(new Request('https://example.test/api/captain/weekly-availability', {
      method: 'POST',
      body: JSON.stringify({ team: 'Aces', league: 'Fall 2027', flight: '4.0', matchDate: '2026-09-14', playerName: 'Sam Edwards', status: 'unavailable', updatedAt: '2026-09-08T18:00:00.000Z' }),
    }))
    const body = await response.json()

    expect(body).toMatchObject({ ok: true, stale: true, availability: { status: 'available' } })
    expect(upserted).toBeNull()
    expect(deleted).toBe(false)
  })
})
