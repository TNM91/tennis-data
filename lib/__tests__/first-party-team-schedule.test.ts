import { createClient } from '@supabase/supabase-js'
import { afterEach, expect, it, vi } from 'vitest'
import { reviewedRevisionDigest } from '../first-party-revisions'
import { loadReviewedTeamNextMatch } from '../first-party-team-schedule'
import { loadFirstPartyCalendarCompetitions } from '../first-party-calendar'
import type { OfficeDetail, OfficeFixture, OfficeLeague } from '../native-league-office-contract'
import { buildTeamRoomScopeId } from '../team-room'

const { service } = vi.hoisted(() => ({ service: vi.fn() }))
vi.mock('../mobile-account-auth', () => ({ accountClient: service }))

const owner = '11111111-1111-4111-8111-111111111111'
const scope = { teamName: 'Baseline Aces', leagueName: 'City League', flight: '4.0',
  roomId: '22222222-2222-4222-8222-222222222222', scheduleLeagueId: 'tiq-city-spring' }
const now = new Date('2026-04-11T02:00:00Z')
const league: OfficeLeague = {
  id: scope.scheduleLeagueId, name: scope.leagueName, flight: scope.flight, format: 'team',
  season: 'Spring', status: 'active', location: 'City Courts', startsOn: '2026-04-01', endsOn: '',
  timeZone: 'America/Chicago', updatedAt: '2026-04-01T12:00:00Z',
}
const next: OfficeFixture = {
  id: '33333333-3333-4333-8333-333333333333', a: 'Topspin Club', b: scope.teamName, date: '2026-04-10', time: '21:30:00',
  facility: 'Court 2', status: 'coordinator_set',
}
const fixtures: OfficeFixture[] = [
  { ...next, id: 'later', date: '2026-04-12', status: 'confirmed' },
  { ...next, id: 'another-team', b: 'Drop Shot Club', date: '2026-04-11', status: 'confirmed' },
  { ...next, id: 'without-time', time: '', status: 'confirmed' },
  { ...next, id: 'cancelled', time: '18:00', status: 'cancelled' },
  { ...next, id: 'proposed', time: '19:00', status: 'proposed' },
  { ...next, id: 'completed', time: '20:00', status: 'completed' },
  { ...next, id: 'earlier-today', time: '20:30', status: 'confirmed' },
  next,
  { ...next, id: 'yesterday', date: '2026-04-09', status: 'confirmed' },
].sort((a,b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
const participants = [scope.teamName, 'Drop Shot Club', 'Topspin Club'].map(name => ({ name, status: 'active' }))

function database(stale = false, changed?: OfficeFixture, activeMembership = true) {
  const calls: URL[] = []
  const client = createClient('https://teams.example.test', 'synthetic-anon', { auth: { persistSession: false },
    global: { fetch: async input => {
      const url = new URL(String(input))
      calls.push(url)
      switch (url.pathname.split('/').at(-1)) {
        case 'tiq_leagues':
          return Response.json([{ id: league.id, is_public: true, league_name: league.name, league_format: league.format,
            season_label: league.season, season_status: league.status, flight: league.flight, location_label: league.location,
            starts_on: league.startsOn, ends_on: null, schedule_time_zone: league.timeZone, updated_at: league.updatedAt }])
        case 'tiq_team_league_entries':
          return Response.json(participants.map(row => ({ league_id: league.id, team_name: row.name, entry_status: row.status })))
        case 'tiq_league_schedule_items':
          return Response.json(fixtures.map(fixture => changed?.id === fixture.id ? changed : fixture).map(fixture => ({ id: fixture.id, league_id: league.id, league_format: league.format,
            participant_a_name: fixture.a, participant_b_name: fixture.b, scheduled_date: fixture.date, scheduled_time: fixture.time,
            facility: stale && fixture.id === next.id ? 'Unreviewed court' : fixture.facility, status: fixture.status })))
        case 'native_first_party_league_matches':
          return Response.json(changed ? [{ match: { ...changed, court: '2', duration: 120 }, original: next }] : [])
        case 'team_profile_links':
          return Response.json([{ ...scope, profile_user_id:owner, team_name:scope.teamName, league_name:scope.leagueName,
            status:'accepted',archived_at:null,source_type:'tiq_entry',team_roles:['player'] }])
        case 'internal_conversations':
          return Response.json([{ id:scope.roomId,related_entity_id:buildTeamRoomScopeId(scope) }])
        case 'internal_conversation_participants':
          return Response.json(activeMembership ? [{ conversation_id:scope.roomId }] : [])
        default:
          return Response.json([])
      }
    } },
  })
  return { client, calls }
}

function approveSchedule() {
  const detail: OfficeDetail = { league, participants, fixtures, results: [], standings: [],
    moreParticipants: false, moreFixtures: false, moreResults: false, standingsAvailable: true }
  vi.stubEnv('TIQ_FIRST_PARTY_LEAGUE_APPROVALS', JSON.stringify({
    [league.id]: { summary: reviewedRevisionDigest(league), detail: reviewedRevisionDigest(detail) },
  }))
}

afterEach(() => vi.unstubAllEnvs())

it('returns the earliest upcoming confirmed fixture in the linked season’s local date', async () => {
  approveSchedule()
  const { client, calls } = database()
  expect(await loadReviewedTeamNextMatch(client, owner, scope, now)).toEqual({
    opponent: 'Topspin Club', date: '2026-04-10', time: '21:30', facility: 'Court 2', timeZone: 'America/Chicago',
  })
  expect(calls.filter(call => call.pathname.endsWith('/tiq_leagues')).map(call => call.searchParams.get('id')))
    .toEqual(['eq.' + league.id, 'eq.' + league.id])
  expect(await loadReviewedTeamNextMatch(client, owner, { ...scope, flight: '4.5' }, now)).toBeNull()
  expect(await loadReviewedTeamNextMatch(client, owner, scope, new Date('2026-04-15T12:00:00Z'))).toBeNull()
})

it('skips an unlinked chat and rejects a withdrawn or changed schedule', async () => {
  approveSchedule()
  const { client, calls } = database()
  expect(await loadReviewedTeamNextMatch(client, owner, { ...scope, scheduleLeagueId: undefined }, now)).toBeNull()
  await expect(loadReviewedTeamNextMatch(client, owner, { ...scope, scheduleLeagueId: 'other-season' }, now)).rejects.toThrow('League unavailable')
  expect(calls).toHaveLength(0)
  await expect(loadReviewedTeamNextMatch(database(true).client, owner, scope, now)).rejects.toThrow('League records changed')
})

it('removes the postponed slot from team members’ calendars and restores the same fixture at the new time', async () => {
  approveSchedule()
  vi.stubEnv('TIQ_FIRST_PARTY_TEAM_ROOMS', JSON.stringify([scope]))
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic')
  const matchId = 'league:' + league.id + ':' + next.id
  const original = database()
  service.mockReturnValue(original.client)
  expect(await loadFirstPartyCalendarCompetitions(original.client, owner)).toContainEqual(expect.objectContaining({id:matchId,time:'21:30'}))

  const postponed = database(false, {...next,time:'21:30',status:'postponed'})
  service.mockReturnValue(postponed.client)
  const postponedEvents = await loadFirstPartyCalendarCompetitions(postponed.client, owner)
  expect(postponedEvents.length).toBeGreaterThan(0)
  expect(postponedEvents).not.toContainEqual(expect.objectContaining({id:matchId}))
  const rescheduled = database(false,{...next,date:'2026-04-14',time:'19:30',status:'coordinator_set'})
  service.mockReturnValue(rescheduled.client)
  expect(await loadFirstPartyCalendarCompetitions(rescheduled.client, owner)).toContainEqual(expect.objectContaining({
    id:matchId,date:'2026-04-14',time:'19:30',timeZone:league.timeZone,publishedView:{id:league.id},
  }))
  const formerMember=database(false,undefined,false)
  service.mockReturnValue(formerMember.client)
  expect(await loadFirstPartyCalendarCompetitions(formerMember.client, owner)).toEqual([])
})
