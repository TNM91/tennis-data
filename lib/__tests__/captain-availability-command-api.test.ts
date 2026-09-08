import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), service: vi.fn() }))
vi.mock('@/lib/captain-api-auth', () => ({ getCaptainApiAuth: mocks.auth }))
vi.mock('@/lib/captain-availability-request-server', () => ({
  cleanAvailabilityText: (value: unknown, maxLength = 160) => String(value ?? '').trim().slice(0, maxLength),
  getCaptainAvailabilityServiceClient: mocks.service,
  isUuid: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
}))

import { PATCH } from '@/app/api/captain/availability-requests/route'

type Result = { data?: unknown; error?: unknown }
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
      for (const method of ['select', 'eq', 'ilike', 'limit', 'delete']) {
        query[method] = (...args: unknown[]) => {
          record.calls.push([method, args])
          return query
        }
      }
      query.upsert = (...args: unknown[]) => {
        record.calls.push(['upsert', args])
        return Promise.resolve(result)
      }
      return query
    }),
  }
}

const requestId = '12345678-1234-4123-8123-123456789012'
const playerId = '87654321-4321-4123-8123-210987654321'
const savedRequest = {
  id: requestId,
  created_by: 'captain',
  team_name: 'Aces',
  league_name: 'Fall League',
  flight: '4.0',
  match_date: '2026-09-14',
  expires_at: '2027-01-01T00:00:00.000Z',
}
const invite = { player_id: playerId, player_name: 'Jordan Player' }
const patchRequest = (status: string) => new Request('https://example.test/api/captain/availability-requests', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ requestId, playerId, playerName: invite.player_name, status }),
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ ok: true, userId: 'captain' })
})

describe('captain availability reply updates', () => {
  it('saves a captain-entered yes to both the reply inbox and lineup availability', async () => {
    const service = database({
      captain_availability_requests: [{ data: [savedRequest] }],
      captain_availability_request_invites: [{ data: [invite] }],
      captain_availability_request_responses: [{ error: null }],
      lineup_availability: [{ error: null }],
    })
    mocks.service.mockReturnValue(service)

    const response = await PATCH(patchRequest('in'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, status: 'available' })
    const replyWrite = service.queries.find((query) => query.table === 'captain_availability_request_responses')
    const lineupWrite = service.queries.find((query) => query.table === 'lineup_availability')
    expect(replyWrite?.calls).toContainEqual(['upsert', [expect.objectContaining({ player_id: playerId, status: 'available' }), { onConflict: 'request_id,player_name,match_date' }]])
    expect(lineupWrite?.calls).toContainEqual(['upsert', [expect.objectContaining({ player_id: playerId, status: 'available' }), { onConflict: 'match_date,team_name,player_id' }]])
  })

  it('resets the saved reply without deleting another player or match', async () => {
    const service = database({
      captain_availability_requests: [{ data: [savedRequest] }],
      captain_availability_request_invites: [{ data: [invite] }],
      captain_availability_request_responses: [{ error: null }],
      lineup_availability: [{ error: null }],
    })
    mocks.service.mockReturnValue(service)

    const response = await PATCH(patchRequest('unanswered'))
    expect(response.status).toBe(200)
    const replyDelete = service.queries.find((query) => query.table === 'captain_availability_request_responses')
    const lineupDelete = service.queries.find((query) => query.table === 'lineup_availability')
    expect(replyDelete?.calls).toContainEqual(['eq', ['request_id', requestId]])
    expect(replyDelete?.calls).toContainEqual(['eq', ['player_name', invite.player_name]])
    expect(replyDelete?.calls).toContainEqual(['eq', ['match_date', savedRequest.match_date]])
    expect(lineupDelete?.calls).toContainEqual(['eq', ['player_id', playerId]])
  })

  it('requires captain authentication before changing a reply', async () => {
    mocks.auth.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) })
    expect((await PATCH(patchRequest('in'))).status).toBe(401)
    expect(mocks.service).not.toHaveBeenCalled()
  })
})
