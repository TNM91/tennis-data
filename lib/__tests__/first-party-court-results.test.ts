import { createClient } from '@supabase/supabase-js'
import { afterEach, expect, it, vi } from 'vitest'
import { GET } from '../../app/api/mobile/first-party/court-results/route'
import { loadCourtDesk, loadPostedCourtScorecards, publishCourtResult } from '../first-party-court-results'
import { readCourtSubmission } from '../native-court-result-contract'

const captain = '11111111-1111-4111-8111-111111111111', partner = '22222222-2222-4222-8222-222222222222'
const opponent = '33333333-3333-4333-8333-333333333333', second = '44444444-4444-4444-8444-444444444444'
const outsider = '55555555-5555-4555-8555-555555555555', fixtureId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const a = { teamName: 'Aces', leagueName: 'City League', flight: '4.0', roomId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }
const b = { ...a, teamName: 'Rally', roomId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }
const revision = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', correction = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const league = 'city-league', date = '2026-11-01'
const fixture = { id: fixtureId, a: a.teamName, b: b.teamName, date, status: 'confirmed' }
let entitled = true

vi.mock('../native-competitions', () => ({
  loadFirstPartyNativeCompetitions: async () => ({ detail: { league: { name: a.leagueName, flight: a.flight, format: 'team', timeZone: 'UTC' }, fixtures: [fixture] } }),
}))
vi.mock('../player-api-auth', () => ({ loadPlayerAccess: async () => ({ canUseCaptainWorkflow: entitled }) }))

function database() {
  vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', JSON.stringify([a, b]))
  vi.stubEnv('TIQ_FIRST_PARTY_LEAGUE_APPROVALS', JSON.stringify({ [league]: { summary: 'a'.repeat(64), detail: 'b'.repeat(64) } }))
  let stored: Record<string, unknown> | undefined
  const removed = new Set<string>()
  const activity: string[] = []
  const people = [[captain, a], [partner, a], [opponent, b], [second, b]] as const
  const client = createClient('https://courts.example.test', 'synthetic', { auth: { persistSession: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input)), params = url.searchParams
    const eq = (key: string) => params.get(key)?.slice(3)
    const table = url.pathname.split('/').at(-1), method = init?.method ?? 'GET'
    activity.push(method + ' ' + table)
    switch (table) {
      case 'team_profile_links': return Response.json(people.flatMap(([id, room]) => {
        if (eq('profile_user_id') && eq('profile_user_id') !== id || eq('team_name') && eq('team_name') !== room.teamName) return []
        return [{ profile_user_id: id, team_role: id === captain ? 'captain' : 'player', team_roles: [], team_name: room.teamName,
          league_name: room.leagueName, flight: room.flight, status: 'accepted', archived_at: null, source_type: 'manual_invite' }]
      }))
      case 'internal_conversations': return Response.json([{ id: eq('id') }])
      case 'internal_conversation_participants': return Response.json(people.flatMap(([id, room]) => eq('conversation_id') === room.roomId &&
        (!eq('profile_id') || eq('profile_id') === id) ? [{ profile_id: id, last_read_at: null }] : []))
      case 'team_room_member_removals': return Response.json(people.flatMap(([id, room]) => removed.has(id) && eq('conversation_id') === room.roomId &&
        (!eq('profile_id') || eq('profile_id') === id) ? [{ profile_id: id }] : []))
      case 'profiles': return Response.json(people.map(([id]) => ({ id, message_display_name: 'Player ' + id.slice(0, 1) })))
      case 'tiq_league_schedule_items': return Response.json([{ id: fixtureId, league_id: league, league_format: 'team', scheduled_date: date,
        participant_a_name: a.teamName, participant_b_name: b.teamName, status: 'confirmed' }])
      case 'native_captain_court_results': {
        if (method === 'POST' && stored) return Response.json({ code: '23505' }, { status: 409 })
        if (method === 'PATCH' && eq('revision') !== stored?.revision) return Response.json([])
        if (method === 'POST' || method === 'PATCH') stored = JSON.parse(String(init?.body))
        return Response.json(stored ? [stored] : [])
      }
      default: throw Error('Unexpected table ' + table)
    }
  } } })
  return { client, removed, activity }
}

const original = { court: 1, format: 'doubles', a: [captain, partner], b: [opponent, second], winner: 'A', score: '6-4 6-3', revision, expected: null }
afterEach(() => { entitled = true; vi.unstubAllEnvs() })

it('publishes one reviewed court, returns the opposite outcome for each side, and updates the same key on correction', async () => {
  const { client, removed, activity } = database()
  const input = readCourtSubmission(original)
  await expect(loadCourtDesk(client, client, captain, league, fixtureId)).resolves.toMatchObject({ captain: true, membersA: [{ id: captain }, { id: partner }] })
  await expect(loadCourtDesk(client, client, partner, league, fixtureId)).resolves.toMatchObject({ captain: false, membersA: [], membersB: [] })
  await expect(publishCourtResult(client, client, partner, league, fixtureId, input)).rejects.toMatchObject({ status: 403 })
  await expect(publishCourtResult(client, client, captain, league, fixtureId,
    readCourtSubmission({ ...original, b: [outsider, second] }))).rejects.toMatchObject({ status: 403 })
  entitled = false
  await expect(publishCourtResult(client, client, captain, league, fixtureId, input)).rejects.toMatchObject({ status: 403 })
  entitled = true
  expect(activity.some(line => line.startsWith('POST'))).toBe(false)

  const posted = await publishCourtResult(client, client, captain, league, fixtureId, input)
  await expect(publishCourtResult(client, client, captain, league, fixtureId, input)).resolves.toEqual(posted)
  const key = `league:${league}:${fixtureId}:court:1`
  for (const id of [captain, partner, opponent, second]) {
    const result = await loadPostedCourtScorecards(client, id)
    expect(result).toEqual([expect.objectContaining({ id: key, outcome: id === captain || id === partner ? 'Won' : 'Lost' })])
    expect(JSON.stringify(result)).not.toContain(captain)
  }
  await expect(loadPostedCourtScorecards(client, outsider)).resolves.toEqual([])
  removed.add(second)
  await expect(loadPostedCourtScorecards(client, second)).resolves.toEqual([])
  removed.delete(second)

  const change = readCourtSubmission({ ...original, winner: 'B', score: '4-6 3-6', revision: correction, expected: revision })
  await publishCourtResult(client, client, captain, league, fixtureId, change)
  await expect(publishCourtResult(client, client, captain, league, fixtureId, input)).rejects.toMatchObject({ status: 409 })
  await expect(loadPostedCourtScorecards(client, partner)).resolves.toEqual([expect.objectContaining({ id: key, outcome: 'Lost', score: '4-6 3-6' })])
  expect(activity.every(line => !/matches|players|tennisrecord|usta|import/.test(line))).toBe(true)
})

it('rejects a claimed winner that disagrees with the score and denies unauthenticated access', async () => {
  expect(() => readCourtSubmission({ ...original, winner: 'B' })).toThrow(/winner must match/)
  const denied = await GET(new Request('https://www.tenaceiq.com/api/mobile/first-party/court-results'))
  expect(denied.status).toBe(401)
  expect(await denied.json()).toEqual({ ok: false, releaseScope: 'first-party' })
})
