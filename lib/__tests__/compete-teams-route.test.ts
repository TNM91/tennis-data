import { afterEach, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: db, from: db.from }) }))
vi.mock('server-only', () => ({}))

import { GET } from '../../app/api/team-rooms/teams/route'

afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
})

it('lists only the signed-in account’s accepted teams without opening a chat', async () => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-service-key')
  db.getUser.mockResolvedValue({ data: { user: { id: 'signed-in-player' } }, error: null })
  const links = [
    { team_name: 'Aces', league_name: 'City League', flight: '4.0', team_roles: ['player', 'co_captain'] },
    { team_name: 'Aces', league_name: 'Evening League', flight: null, team_role: 'player' },
  ]
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(),
  }
  query.order.mockReturnValueOnce(query).mockResolvedValueOnce({ data: links, error: null })
  db.from.mockReturnValue(query)

  const request = new Request('https://example.test/api/team-rooms/teams?read=1&owner=other', {
    headers: { Authorization: 'Bearer synthetic' },
  })
  const response = await GET(request)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toEqual({
    ok: true,
    owner: 'signed-in-player',
    teams: [
      { teamName: 'Aces', leagueName: 'City League', flight: '4.0', canManage: true },
      { teamName: 'Aces', leagueName: 'Evening League', flight: '', canManage: false },
    ],
  })
  expect(db.from.mock.calls).toEqual([['team_profile_links']])
  expect(query.eq.mock.calls).toEqual([['profile_user_id', 'signed-in-player'], ['status', 'accepted']])
})
