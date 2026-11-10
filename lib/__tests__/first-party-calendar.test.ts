import { createClient } from '@supabase/supabase-js'
import { afterEach, expect, it, vi } from 'vitest'
import { loadFirstPartyCalendarCompetitions } from '../first-party-calendar'
import { reviewedRevisionDigest } from '../first-party-revisions'
import { tournamentRevisionDigest } from '../native-tournament-approvals'
import { loadNativeCalendar, respondNativeCalendar } from '../native-calendar'

const owner = '11111111-1111-4111-8111-111111111111'
const date = '2026-11-14', updated = '2026-11-01T09:00:00Z'
const range = { from: '2026-11-09', to: '2026-11-15' }
const league = { id: 'tiq-league', name: 'City League', format: 'individual', season: 'Fall', status: 'active', flight: '',
  location: 'City Courts', startsOn: date, endsOn: '', timeZone: 'America/Chicago', updatedAt: updated }
const fixture = { id: 'fixture-one', a: 'Jordan Lee', b: 'Riley Park', date, time: '18:00', facility: 'Court 2', status: 'confirmed' }
const participants = [{ name: 'Jordan Lee', status: 'active' }, { name: 'Riley Park', status: 'active' }]
const leagueRow = { id: league.id, is_public: true, league_name: league.name, league_format: league.format, season_label: league.season,
  season_status: league.status, flight: league.flight, location_label: league.location, starts_on: date, ends_on: null,
  schedule_time_zone: league.timeZone, updated_at: updated }
const detail = { league, participants, fixtures: [fixture], results: [], standings: [], moreParticipants: false, moreFixtures: false,
  moreResults: false, standingsAvailable: false }
const parent = { id: 'fall-open', event_id: null, is_event: true, is_public: true, name: 'Fall Open', format: 'single_elimination',
  entrant_type: 'players', status: 'scheduled', starts_on: date, location_label: 'Park Courts', event_details: {}, updated_at: updated,
  entrants: [], results: {}, schedule: {} }
const division = { ...parent, id: 'fall-open-division', event_id: parent.id, is_event: false, name: 'Fall Open Singles',
  entrants: ['Jordan Lee', 'Drew Spin'], schedule: { 'r1-m1': { date, time: '15:00', court: '1' } } }
const personal = { id: 'player-calendar-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', player_user_id: owner, title: 'Serve practice',
  scheduled_date: date, scheduled_time: '', kind: 'practice', created_at: updated, updated_at: updated }

function approvals(includeParent = true) {
  vi.stubEnv('TIQ_FIRST_PARTY_LEAGUE_APPROVALS', JSON.stringify({ [league.id]: { summary: reviewedRevisionDigest(league), detail: reviewedRevisionDigest(detail) } }))
  const review = (row: typeof parent | typeof division) => ({ summary: tournamentRevisionDigest(row), draw: tournamentRevisionDigest(row, true) })
  vi.stubEnv('TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS', JSON.stringify({ ...(includeParent ? { [parent.id]: review(parent) } : {}), [division.id]: review(division) }))
}

function database({ stale = false, foreign = false } = {}) {
  const calls: { url: URL; method: string }[] = []
  const client = createClient('https://calendar.example.test', 'synthetic-anon', { auth: { persistSession: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input)), params = url.searchParams
    calls.push({ url, method: init?.method || 'GET' })
    switch (url.pathname.split('/').at(-1)) {
      case 'player_calendar_items': return Response.json([personal,
        { ...personal, id: 'calendar-1794000000000-deadbeef', title: 'Manually saved on web' },
        { ...personal, id: 'team-schedule-owner-aces-match', title: 'Imported opponent' },
        { ...personal, id: 'message-calendar-old-reminder', title: 'Extracted from message' }])
      case 'coach_player_links': return Response.json([{ id: 'coach-link', player_user_id: owner, status: 'active', player_name: 'Linked directory name' }])
      case 'coach_assignments': return Response.json([{ id: 'shared-one', student_link_id: 'coach-link', title: 'Volley footwork', focus: '', status: 'assigned',
        due_date: null, assignment_json: { lessonDateTime: date+'T09:00', lessonLocation: 'Coach court' }, updated_at: updated }])
      case 'tiq_leagues': return Response.json([leagueRow])
      case 'tiq_player_league_entries': return Response.json(params.has('created_by_user_id')
        ? [{ league_id: league.id, player_name: 'JORDAN LEE', created_by_user_id: foreign ? 'foreign-owner' : owner, entry_status: 'active' }]
        : participants.map(p => ({ league_id: league.id, player_name: p.name, entry_status: p.status })))
      case 'tiq_league_schedule_items': return Response.json([{ id: fixture.id, league_id: league.id, league_format: league.format, participant_a_name: fixture.a,
        participant_b_name: stale ? 'Unreviewed opponent' : fixture.b, scheduled_date: date, scheduled_time: fixture.time, facility: fixture.facility, status: fixture.status,
        notes: 'Unreviewed fixture notes' }])
      case 'tiq_tournament_entries': return Response.json([{ tournament_id: division.id, player_name: 'Jordan Lee', submitted_by_user_id: owner, status: 'approved' }])
      case 'tiq_tournaments': return Response.json(params.getAll('id').includes('eq.'+parent.id) ? [parent] : [division])
      case 'player_schedule_responses': return Response.json(params.get('competition_id')?.includes(league.id)
        ? [{ event_id: 'league:'+league.id+':'+fixture.id, competition_kind: 'league', competition_id: league.id,
          player_user_id: owner, response: 'available', event_snapshot: { date, time: fixture.time, location: fixture.facility }, updated_at: updated }] : [])
      default: return Response.json([])
    }
  } } })
  return { client, calls }
}

afterEach(() => vi.unstubAllEnvs())

it('maps reviewed fixtures and draws alongside manual and coach dates without imported metadata', async () => {
  approvals()
  const { client, calls } = database()
  const result = await loadNativeCalendar(client, owner, range, loadFirstPartyCalendarCompetitions)
  expect(result.personal.map(item => item.title)).toEqual(['Serve practice', 'Manually saved on web'])
  expect(result.coach).toEqual([expect.objectContaining({ title: 'Coaching lesson', date, time: '09:00' })])
  expect(result.competitions).toEqual([
    expect.objectContaining({ id: 'league:tiq-league:fixture-one', opponent: 'Riley Park', responseStatus: 'available', publishedView: { id: league.id } }),
    expect.objectContaining({ id: 'tournament:fall-open-division:r1-m1', opponent: 'Drew Spin', scorecardFormat: 'singles', publishedView: { id: parent.id, divisionId: division.id } }),
  ])
  expect(JSON.stringify(result)).not.toMatch(/Imported opponent|Extracted from message|Unreviewed fixture notes|Linked directory name/)
  const entries = calls.find(call => call.url.pathname.endsWith('/tiq_player_league_entries') && call.url.searchParams.has('created_by_user_id'))!
  expect(entries.url.searchParams.get('league_id')).toBe('in.(tiq-league)')
  expect(entries.url.searchParams.get('created_by_user_id')).toBe('eq.'+owner)
})

it('drops changed fixtures, and denies direct availability writes if the event is no longer reviewed', async () => {
  approvals()
  const { client, calls } = database({ stale: true })
  const result = await loadFirstPartyCalendarCompetitions(client, owner)
  expect(result.map(event => event.competitionId)).toEqual([division.id])
  await expect(respondNativeCalendar(client, owner, { action: 'respond', eventId: 'league:tiq-league:fixture-one', response: 'available',
    snapshot: { title: 'City League: vs Riley Park', date, time: fixture.time, location: fixture.facility }, expectedResponseUpdatedAt: '',
    requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, loadFirstPartyCalendarCompetitions)).rejects.toMatchObject({ status: 409 })
  expect(calls.every(call => call.method === 'GET')).toBe(true)
})

it('skips divisions with an unreviewed parent and rejects unexpected owners', async () => {
  approvals(false)
  expect((await loadFirstPartyCalendarCompetitions(database().client, owner)).map(event => event.competitionId)).toEqual([league.id])
  await expect(loadFirstPartyCalendarCompetitions(database({ foreign: true }).client, owner)).rejects.toThrow('Calendar entries changed')
})

it('does not look up competition records when the reviewed catalogs are empty', async () => {
  vi.stubEnv('TIQ_FIRST_PARTY_LEAGUE_APPROVALS', '')
  vi.stubEnv('TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS', '')
  const { client, calls } = database()
  expect(await loadFirstPartyCalendarCompetitions(client, owner)).toEqual([])
  expect(calls).toHaveLength(0)
})
