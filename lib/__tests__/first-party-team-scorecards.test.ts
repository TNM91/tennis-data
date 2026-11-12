import { createClient } from '@supabase/supabase-js'
import { afterEach, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/mobile/first-party/court-results/route'
import { loadPrivateTeamScorecards } from '../first-party-team-results'
import { privateTeamLeagueKey } from '../private-team-contract'
import { teamResultScorecardKey, teamScorecardsHeader } from '../team-results-contract'
import { buildTeamRoomScopeId } from '../team-room'

const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const roomId = '33333333-3333-4333-8333-333333333333'
const otherRoom = '44444444-4444-4444-8444-444444444444'
const id = (suffix: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(suffix).padStart(12, '0')}`
const team = { teamName: 'Baseline Aces', leagueName: privateTeamLeagueKey(roomId), flight: '4.5' }
const revision = id(30)
const date = '2026-11-01'
const now = new Date('2026-11-02T12:00:00Z')
const match = { opponent: 'Topspin Club', date, time: '18:00', facility: 'Court 2', timeZone: 'America/Chicago' }
const assignment = { profile_id: owner, court_number: 2, result_revision: revision }
const seats = [assignment, { court_number: 2, result_revision: revision }, { court_number: 1, result_revision: revision }]
const row = { room_id: roomId, fixture_id: id(1), match_date: date, fixture: match,
  result_revision: revision, court_scores: ['6-4, 6-4', '4-6, 4-6'], own: [assignment], seats }
const reviewed = { id: `league:city-league:${id(20)}:court:1`, calendar_match_id: `league:city-league:${id(20)}:court:1`,
  match_date: date, opponent: 'Break Point Club', court: 1, score: '6-4, 6-4', scoreOrder: 'Baseline Aces – Break Point Club',
  format: 'singles', outcome: 'Won' }

const auth = vi.hoisted(() => ({ client: vi.fn(), account: vi.fn() }))
vi.mock('../mobile-account-auth', () => ({
  accountClient: auth.client, verifiedAccount: auth.account,
  accountResponse: (body: object, status: number, headers: HeadersInit) => Response.json(body, { status, headers }),
}))
vi.mock('../first-party-court-results', () => ({
  CourtUnavailable: Error, loadPostedCourtScorecards: async () => [reviewed],
}))

function database() {
  const state = { linked: true, matchingScope: true, participant: true, removed: false, broken: false }
  const requests: URL[] = []
  const client = createClient('https://team-courts.example.test', 'synthetic', { auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(String(input))
    requests.push(url)
    switch (url.pathname.split('/').at(-1)) {
      case 'team_profile_links': return Response.json(state.linked ? [{ profile_user_id: owner, team_name: team.teamName,
        league_name: team.leagueName, flight: team.flight, status: 'accepted', archived_at: null, source_type: 'manual_invite' }] : [])
      case 'native_private_teams': return Response.json([{ room_id: roomId, team_name: team.teamName, league_label: '', flight: team.flight }])
      case 'internal_conversations': return Response.json([{ id: roomId, related_entity_id: state.matchingScope ? buildTeamRoomScopeId(team) : otherRoom }])
      case 'internal_conversation_participants': return Response.json(state.participant ? [{ conversation_id: roomId }] : [])
      case 'team_room_member_removals': return Response.json(state.removed ? [{ conversation_id: roomId }] : [])
      case 'native_team_fixture_history': return state.broken ? Response.json({ code: '42501' }, { status: 403 }) : Response.json([
        row,
        { ...row, fixture_id: id(2), own: [{ ...assignment, profile_id: other }] },
        { ...row, fixture_id: id(3), own: [{ ...assignment, result_revision: id(31) }] },
        { ...row, fixture_id: id(4), room_id: otherRoom },
        { ...row, fixture_id: id(5), court_scores: ['6-4, 6-4', 'L-DEFAULT'] },
        { ...row, fixture_id: id(6), match_date: '2099-11-01', fixture: { ...match, date: '2099-11-01' } },
        { ...row, fixture_id: id(7), own: [], seats: [assignment] },
        { ...row, fixture_id: id(8), seats: [assignment] },
      ])
      default: throw Error('Unexpected team court score query')
    }
  } } })
  return { client, requests, state }
}

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.useRealTimers() })

it('returns only started, assigned courts at the current revision from active manual teams', async () => {
  vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', '[]')
  const { client, requests, state } = database()
  const results = await loadPrivateTeamScorecards(client, owner, now)
  const expected = { date, opponent: match.opponent, score: '4-6, 4-6', teamCourt: 2, outcome: 'Lost' }
  expect(results).toEqual([
    { ...expected, calendarMatchId: teamResultScorecardKey(roomId, id(1)), format: 'doubles' },
    { ...expected, calendarMatchId: teamResultScorecardKey(roomId, id(8)) },
  ])
  const query = requests.at(-1)!.searchParams
  expect(query.get('room_id')).toBe(`in.(${roomId})`)
  expect(query.get('own.profile_id')).toBe(`eq.${owner}`)
  expect(query.get('select')).toContain('own:native_team_result_players!inner')
  expect(query.get('limit')).toBe('20')
  for (const [field, value] of [['linked', false], ['matchingScope', false], ['participant', false], ['removed', true]] as const) {
    const previous = state[field]
    state[field] = value
    requests.length = 0
    await expect(loadPrivateTeamScorecards(client, owner, now)).resolves.toEqual([])
    expect(requests.some(url => url.pathname.endsWith('/native_team_fixture_history'))).toBe(false)
    state[field] = previous
  }
})

it('preserves the original court results response for older app builds', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic')
  vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', '[]')
  const { client, requests, state } = database()
  auth.client.mockReturnValue(client)
  auth.account.mockResolvedValue({ user: { id: owner } })
  const endpoint = 'https://www.tenaceiq.test/api/mobile/first-party/court-results'
  const base = { ok: true, owner, scorecards: [reviewed], releaseScope: 'first-party' }
  await expect((await GET(new Request(endpoint))).json()).resolves.toEqual(base)
  expect(requests).toEqual([])

  const request = () => new Request(endpoint, { headers: { [teamScorecardsHeader]: '1' } })
  await expect((await GET(request())).json()).resolves.toEqual({ ...base, teamScorecards: [expect.any(Object), expect.any(Object)] })
  state.broken = true
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await expect((await GET(request())).json()).resolves.toEqual({ ...base, teamScorecards: null })
})
