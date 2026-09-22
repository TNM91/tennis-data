import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  service: vi.fn(),
  expireTag: vi.fn(),
}))

vi.mock('@/lib/captain-api-auth', () => ({ getCaptainApiAuth: mocks.auth }))
vi.mock('@/lib/captain-availability-request-server', () => ({
  cleanAvailabilityText: (value: unknown, maxLength = 160) => String(value ?? '').trim().slice(0, maxLength),
  getCaptainAvailabilityServiceClient: mocks.service,
  isUuid: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
}))
vi.mock('@vercel/functions', () => ({ getCache: () => ({ expireTag: mocks.expireTag }) }))
vi.mock('@/lib/season-kickoff-server', () => ({ loadSeasonLineupAnswers: vi.fn() }))

import { POST } from '@/app/api/captain/lineup-builder/route'

type Result = { data?: unknown; error?: { message: string } | null }

function database(results: Record<string, Result[]>) {
  const queries: Array<{ table: string; calls: Array<[string, unknown[]]> }> = []
  return {
    queries,
    from: vi.fn((table: string) => {
      const result = results[table]?.shift() || { data: null, error: null }
      const record = { table, calls: [] as Array<[string, unknown[]]> }
      queries.push(record)
      const query: Record<string, unknown> = {
        then: (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve),
      }
      for (const method of ['select', 'eq', 'limit', 'delete', 'single']) {
        query[method] = (...args: unknown[]) => {
          record.calls.push([method, args])
          return query
        }
      }
      query.upsert = (...args: unknown[]) => {
        record.calls.push(['upsert', args])
        return query
      }
      return query
    }),
  }
}

const playerId = '87654321-4321-4123-8123-210987654321'
const request = (status?: string) => new Request('https://example.test/api/captain/lineup-builder', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    teamName: 'Aces',
    leagueName: 'Fall League',
    flight: '4.5',
    matchDate: '2026-09-20',
    playerId,
    status,
  }),
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ ok: true, userId: 'captain', isAdmin: true })
  mocks.expireTag.mockResolvedValue(undefined)
})

describe('lineup builder captain confirmation', () => {
  it('removes the saved answer when the captain undoes Yes', async () => {
    const service = database({
      team_profile_links: [{ data: [], error: null }],
      lineup_availability: [{ error: null }],
    })
    mocks.service.mockReturnValue(service)

    const response = await POST(request('pending'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      availability: { player_id: playerId, status: 'pending' },
    })

    const reset = service.queries.find((query) => query.table === 'lineup_availability')
    expect(reset?.calls).toContainEqual(['delete', []])
    expect(reset?.calls).toContainEqual(['eq', ['match_date', '2026-09-20']])
    expect(reset?.calls).toContainEqual(['eq', ['team_name', 'Aces']])
    expect(reset?.calls).toContainEqual(['eq', ['player_id', playerId]])
    expect(reset?.calls.some(([method]) => method === 'upsert')).toBe(false)
    expect(mocks.expireTag).toHaveBeenCalledWith('captain-lineup:captain:aces')
  })

  it('still persists a captain-entered Yes as available', async () => {
    const saved = {
      id: 'saved',
      match_date: '2026-09-20',
      team_name: 'Aces',
      league_name: 'Fall League',
      flight: '4.5',
      player_id: playerId,
      status: 'available',
      notes: 'Confirmed by captain from Lineup Builder.',
      responded_at: '2026-09-14T16:00:00.000Z',
    }
    const service = database({
      team_profile_links: [{ data: [], error: null }],
      lineup_availability: [{ data: saved, error: null }],
    })
    mocks.service.mockReturnValue(service)

    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, availability: { status: 'available' } })
    const confirmation = service.queries.find((query) => query.table === 'lineup_availability')
    expect(confirmation?.calls).toContainEqual([
      'upsert',
      [expect.objectContaining({ player_id: playerId, status: 'available' }), { onConflict: 'match_date,team_name,player_id' }],
    ])
  })
})
