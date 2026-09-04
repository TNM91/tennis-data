import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getClaims: vi.fn(),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mocks.from, auth: { getClaims: mocks.getClaims } }),
}))
vi.mock('@vercel/functions', () => ({
  getCache: () => ({ get: mocks.cacheGet, set: mocks.cacheSet }),
}))
vi.mock('@/lib/supabase', () => ({ supabaseUrl: 'https://test.invalid', supabaseKey: 'test-key' }))
vi.mock('@/lib/team-invite-offers', () => ({ getPublicTeamInviteOffers: vi.fn() }))

import { GET } from '@/app/api/team-connections/route'

type Row = Record<string, unknown>
let tables: Record<string, Row[]>

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1', email: 'player@example.test' } }, error: null })
  mocks.cacheGet.mockResolvedValue(undefined)
  tables = {
    profiles: [{ id: 'user-1', linked_player_id: 'player-1' }],
    team_profile_links: [{
      id: 'saved-1', profile_user_id: 'user-1', team_name: 'Summer Team',
      league_name: 'Summer', flight: '4.0', team_role: 'player',
      status: 'accepted', source_type: 'roster_membership', is_default: true,
    }],
    team_roster_members: [{
      id: 'fall-membership', team_name: 'Fall Team', league_name: 'Fall',
      flight: '4.0', player_id: 'player-1', player_name: 'Test Player',
    }],
    captain_roster_contacts: [],
    tiq_team_league_entries: [],
  }
  mocks.from.mockImplementation((table: string) => {
    const predicates: Array<(row: Row) => boolean> = []
    const result = () => ({ data: (tables[table] || []).filter((row) => predicates.every((match) => match(row))), error: null })
    const query = {
      select: () => query,
      order: () => query,
      limit: () => query,
      eq: (field: string, value: unknown) => { predicates.push((row) => row[field] === value); return query },
      in: (field: string, values: unknown[]) => { predicates.push((row) => values.includes(row[field])); return query },
      maybeSingle: async () => ({ ...result(), data: result().data[0] || null }),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    }
    return query
  })
})

afterEach(() => vi.unstubAllEnvs())

async function discover() {
  const response = await GET(new Request('http://localhost/api/team-connections?refresh=1', {
    headers: { Authorization: 'Bearer test-token' },
  }))
  expect(response.status).toBe(200)
  return response.json()
}

describe('additional team discovery', () => {
  it('offers a new season for review even when another team is already accepted', async () => {
    const result = await discover()
    expect(result.connections).toEqual([expect.objectContaining({ id: 'saved-1', status: 'accepted', isDefault: true })])
    expect(result.pending).toEqual([expect.objectContaining({
      id: 'roster_membership:fall-membership', teamName: 'Fall Team', status: 'pending', roles: ['player'],
    })])
  })

  it('does not offer another player’s team or revive a team the user unlinked', async () => {
    tables.team_roster_members.push({
      id: 'other-membership', team_name: 'Opponent', league_name: 'Fall', flight: '4.0',
      player_id: 'player-2', player_name: 'Another Player',
    })
    tables.team_profile_links.push({
      id: 'unlinked-1', profile_user_id: 'user-1', team_name: 'Fall Team', league_name: 'Fall',
      flight: '4.0', team_role: 'player', source_type: 'roster_membership', status: 'unlinked',
    })
    const result = await discover()
    expect(result.pending).toEqual([])
    expect(result.connections).toHaveLength(2)
    expect(result.connections).toContainEqual(expect.objectContaining({ id: 'unlinked-1', status: 'unlinked' }))
  })

  it('requires sign-in before reading team membership', async () => {
    const response = await GET(new Request('http://localhost/api/team-connections'))
    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
