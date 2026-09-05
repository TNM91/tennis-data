import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getClaims: vi.fn(),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheExpire: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mocks.from, auth: { getClaims: mocks.getClaims } }),
}))
vi.mock('@vercel/functions', () => ({
  getCache: () => ({ get: mocks.cacheGet, set: mocks.cacheSet, expireTag: mocks.cacheExpire }),
}))
vi.mock('@/lib/supabase', () => ({ supabaseUrl: 'https://test.invalid', supabaseKey: 'test-key' }))

import { GET, POST } from '@/app/api/team-connections/route'

type Row = Record<string, unknown>
let tables: Record<string, Row[]>

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1', email: 'player@example.test' } }, error: null })
  mocks.cacheGet.mockResolvedValue(undefined)
  mocks.cacheExpire.mockResolvedValue(undefined)
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
    let update: Row | undefined
    let upsert: Row | undefined
    const result = () => {
      let written: Row | undefined
      if (upsert) {
        const existing = tables[table].find((row) => ['profile_user_id', 'normalized_team_name', 'league_name', 'flight'].every((key) => row[key] === upsert?.[key]))
        written = existing ? Object.assign(existing, upsert) : { id: 'new-link', ...upsert }
        if (!existing) tables[table].push(written)
      }
      const data = written ? [written] : (tables[table] || []).filter((row) => predicates.every((match) => match(row)))
      if (update) data.forEach((row) => Object.assign(row, update))
      return { data, error: null }
    }
    const query = {
      select: () => query,
      order: () => query,
      limit: () => query,
      update: (value: Row) => { update = value; return query },
      upsert: (value: Row) => { upsert = value; return query },
      eq: (field: string, value: unknown) => { predicates.push((row) => row[field] === value); return query },
      in: (field: string, values: unknown[]) => { predicates.push((row) => values.includes(row[field])); return query },
      maybeSingle: async () => ({ ...result(), data: result().data[0] || null }),
      single: async () => ({ ...result(), data: result().data[0] || null }),
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
  it('saves both displayed roles when the captain email matches but the contact has no normalized player name', async () => {
    tables.team_profile_links[0] = {
      ...tables.team_profile_links[0], team_name: 'Fall Team', normalized_team_name: 'fall team', league_name: 'Fall',
      team_roles: ['captain'], team_role: 'captain',
    }
    tables.captain_roster_contacts = [{
      id: 'captain-role', team_name: 'Fall Team', normalized_team_name: 'fall team', league_name: 'Fall', flight: '4.0',
      role: 'captain', email: 'player@example.test', normalized_name: '',
    }]
    const before = await discover()
    expect(before.pending[0]).toMatchObject({ isRoleUpdate: true, roles: ['player', 'captain'] })
    const response = await POST(new Request('http://localhost/api/team-connections', {
      method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', connectionId: before.pending[0].id }),
    }))
    expect(response.status).toBe(200)
    const saved = (await response.json()).connection
    expect(saved).toMatchObject({ roles: ['player', 'captain'], matchedPlayerId: 'player-1', status: 'accepted' })
    expect(saved.roleAcceptedAt.player).toBeTruthy()
    expect((await discover()).pending).toEqual([])
  })

  it('does not borrow a player role from a different season', async () => {
    tables.team_roster_members[0].league_name = 'Other season'
    tables.captain_roster_contacts = [{
      id: 'captain-role', team_name: 'Fall Team', normalized_team_name: 'fall team', league_name: 'Fall', flight: '4.0',
      role: 'captain', email: 'player@example.test', normalized_name: '',
    }]
    const response = await POST(new Request('http://localhost/api/team-connections', {
      method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', connectionId: 'roster_contact:captain-role' }),
    }))
    expect(response.status).toBe(200)
    expect((await response.json()).connection.roles).toEqual(['captain'])
    const saved = tables.team_profile_links.find((row) => row.team_name === 'Fall Team' && row.league_name === 'Fall')
    expect(saved?.team_roles).toEqual(['captain'])
    expect(saved?.matched_player_id).toBeNull()
  })

  it.each(['accept', 'decline'] as const)('persists a role %s and clears the invitation cache before returning', async (action) => {
    tables.team_profile_links[0] = {
      ...tables.team_profile_links[0], team_name: 'Fall Team', normalized_team_name: 'fall team', league_name: 'Fall',
      team_roles: ['player'],
    }
    tables.captain_roster_contacts = [{
      id: 'captain-role', team_name: 'Fall Team', normalized_team_name: 'fall team', league_name: 'Fall', flight: '4.0',
      role: 'captain', email: 'player@example.test', normalized_name: 'test player',
    }]
    expect((await discover()).pending).toContainEqual(expect.objectContaining({ isRoleUpdate: true, roles: ['player', 'captain'] }))
    const response = await POST(new Request('http://localhost/api/team-connections', {
      method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, connectionId: 'roster_contact:captain-role' }),
    }))
    expect(response.status).toBe(200)
    expect(mocks.cacheExpire).toHaveBeenCalledWith('team-connections:user-1')
    const result = await discover()
    expect(result.pending).toEqual([])
    expect(result.connections[0].roles).toEqual(action === 'accept' ? ['player', 'captain'] : ['player'])
    expect(result.connections[0].status).toBe('accepted')
  })

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
