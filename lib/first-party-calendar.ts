import type { SupabaseClient } from '@supabase/supabase-js'
import { readReviewedRevisions } from './first-party-revisions'
import { readTournamentApprovals } from './native-tournament-approvals'
import { loadNativeCompetitions } from './native-competitions'
import { loadNativeTournaments } from './native-tournaments'
import { testflightTournamentId } from './testflight-tournament'
import { applyCompetitionScheduleResponses, mapApprovedCompetitionSchedule, type TournamentScheduleMatch } from './player-competition-schedule'
import type { NativeCalendarCompetition } from './native-calendar-contract'
import { accountClient } from './mobile-account-auth'
import { loadActiveReviewedTeamRoomIds, loadReviewedTeamLinks, readReviewedTeamRooms } from './first-party-team-scopes'

function rows<T>(result: { data: T[] | null; error: unknown }, limit: number) {
  if (result.error || !Array.isArray(result.data) || result.data.length > limit) throw Error('Competition dates unavailable')
  return result.data
}

function playerKey(name: unknown) {
  return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').toLocaleLowerCase() : ''
}

export async function loadFirstPartyCalendarCompetitions(db: SupabaseClient, owner: string): Promise<NativeCalendarCompetition[]> {
  const leagues = readReviewedRevisions(process.env.TIQ_FIRST_PARTY_LEAGUE_APPROVALS, 'detail')
  const tournaments = readTournamentApprovals(process.env.TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS)
  const demoId = testflightTournamentId(owner)
  const allowedTournaments = new Set([...tournaments.keys(), demoId])
  const empty = { data: [], error: null }
  const [leagueResult, tournamentResult, teamLinks] = await Promise.all([
    leagues.size ? db.from('tiq_player_league_entries').select('league_id,player_name,created_by_user_id,entry_status')
      .eq('created_by_user_id', owner).eq('entry_status', 'active').in('league_id', [...leagues.keys()]).limit(101) : empty,
    db.from('tiq_tournament_entries').select('tournament_id,player_name,submitted_by_user_id,status')
      .eq('submitted_by_user_id', owner).eq('status', 'approved').in('tournament_id', [...allowedTournaments]).limit(101),
    (async () => {
      const rooms = readReviewedTeamRooms(process.env.TIQ_FIRST_PARTY_TEAM_ROOMS)
      if (![...rooms.values()].some(room => room.scheduleLeagueId && leagues.has(room.scheduleLeagueId))) return []
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      if (!key) return []
      const service = accountClient(key)
      const links = (await loadReviewedTeamLinks(service, owner, rooms))
        .filter(room => room.scheduleLeagueId && leagues.has(room.scheduleLeagueId))
      const activeRooms = new Set(await loadActiveReviewedTeamRoomIds(service, owner, links))
      return links.filter(room => activeRooms.has(room.roomId))
    })(),
  ])
  const leagueEntries = rows(leagueResult, 100), tournamentEntries = rows(tournamentResult, 100)
  if (leagueEntries.some(entry => entry.created_by_user_id !== owner || entry.entry_status !== 'active' || !leagues.has(entry.league_id)) ||
      tournamentEntries.some(entry => entry.submitted_by_user_id !== owner || entry.status !== 'approved' || !allowedTournaments.has(entry.tournament_id))) {
    throw Error('Calendar entries changed')
  }
  const leagueIds = [...new Set<string>([
    ...leagueEntries.map(entry => entry.league_id),
    ...teamLinks.flatMap(room => room.scheduleLeagueId ? [room.scheduleLeagueId] : []),
  ])]
  const tournamentIds = [...new Set<string>(tournamentEntries.map(entry => entry.tournament_id))].filter(id => id !== demoId)
  const parents = tournamentIds.length ? rows(await db.from('tiq_tournaments').select('id,event_id')
    .in('id', tournamentIds).eq('is_public', true).neq('status', 'draft').limit(51), 50) : []
  if (parents.some(row => !tournamentIds.includes(row.id)) || new Set(parents.map(row => row.id)).size !== parents.length) {
    throw Error('Tournament selection changed')
  }
  if (tournamentEntries.some(entry => entry.tournament_id === demoId)) parents.push({ id: demoId, event_id: null })

  const tasks = [
    ...leagueIds.map(id => async (): Promise<NativeCalendarCompetition[]> => {
      const { detail, publishedSchedule } = await loadNativeCompetitions(db, owner, 'discover', '', id, leagues, false, true)
      if (!detail || detail.moreParticipants || detail.moreFixtures) return []
      const { league, participants } = detail
      const fixtures = publishedSchedule ?? detail.fixtures
      if (league.format === 'team') {
        new Intl.DateTimeFormat('en', { timeZone: league.timeZone })
        const teamNames = new Set(teamLinks.filter(room => room.scheduleLeagueId === id &&
          room.leagueName === league.name && room.flight === league.flight &&
          (publishedSchedule || participants.filter(team => team.name === room.teamName && team.status === 'active').length === 1))
          .map(room => room.teamName))
        return fixtures.flatMap((fixture): NativeCalendarCompetition[] => {
          if (!['confirmed', 'coordinator_set', 'completed'].includes(fixture.status) ||
              teamNames.has(fixture.a) === teamNames.has(fixture.b)) return []
          const own = teamNames.has(fixture.a), opponent = own ? fixture.b : fixture.a
          const time = fixture.time.slice(0, 5)
          if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return []
          return [{ id: 'league:' + id + ':' + fixture.id, kind: 'league', eventType: 'match', competitionId: id,
            competitionName: league.name, title: (own ? fixture.a : fixture.b) + ' vs ' + opponent,
            opponent, date: fixture.date, time, location: fixture.facility,
            detail: league.season || 'League match', href: '',
            status: fixture.status === 'completed' ? 'Completed' : 'Confirmed',
            publishedView: { id }, timeZone: league.timeZone }]
        })
      }
      const ownNames = new Set(leagueEntries.filter(entry => entry.league_id === id).map(entry => playerKey(entry.player_name)))
      const publishedNames = [...new Set(publishedSchedule?.flatMap(fixture => [fixture.a, fixture.b]) ?? [])]
      const matching = (publishedSchedule ? publishedNames.map(name => ({ name })) : participants)
        .filter(participant => ownNames.has(playerKey(participant.name)))
      // A name is only a lookup key. All display values come from the reviewed season.
      if (!matching.length || new Set(matching.map(participant => playerKey(participant.name))).size !== matching.length) return []
      const events = mapApprovedCompetitionSchedule({
        leagueEntries: matching.map(participant => ({ league_id: id, player_name: participant.name })),
        leagues: [{ id, league_name: league.name, season_label: league.season, starts_on: league.startsOn, location_label: league.location }],
        leagueSchedule: fixtures.map(fixture => ({ id: fixture.id, league_id: id, participant_a_name: fixture.a,
          participant_b_name: fixture.b, scheduled_date: fixture.date, scheduled_time: fixture.time, facility: fixture.facility, status: fixture.status })),
        tournamentEntries: [], tournaments: [],
      })
      return events.map(event => ({ ...event, publishedView: { id } }))
    }),
    ...parents.filter(row => row.event_id === null || tournaments.has(row.event_id)).map(row => async (): Promise<NativeCalendarCompetition[]> => {
      const id = String(row.id), parent = row.event_id ? String(row.event_id) : ''
      const { detail } = await loadNativeTournaments(db, owner, '', parent || id, parent ? id : '', tournaments)
      if (!detail?.active || detail.active.id !== id || detail.drawNotice) return []
      const { active, matches } = detail
      const draw: TournamentScheduleMatch[] = matches.map(match => ({ id: match.id, label: match.label, sideA: match.a,
        sideB: match.b, completed: Boolean(match.winner), schedule: { date: match.date, time: match.time, court: match.court } }))
      const events = mapApprovedCompetitionSchedule({
        tournamentEntries: tournamentEntries.filter(entry => entry.tournament_id === id),
        tournaments: [{ id, name: active.name, starts_on: active.date, location_label: active.location }],
        tournamentMatches: new Map([[id, draw]]), leagueEntries: [], leagues: [], leagueSchedule: [],
      })
      const scorecardFormat = active.entrantType === 'teams' ? 'doubles' : 'singles'
      return events.map(event => ({ ...event, publishedView: parent ? { id: parent, divisionId: id } : { id },
        scorecardFormat: id !== demoId && event.eventType === 'match' ? scorecardFormat : undefined }))
    }),
  ]

  // A withdrawn or changed revision drops only that competition. Keep fan-out bounded per account.
  const events = new Map<string, NativeCalendarCompetition | null>()
  for (let i = 0; i < tasks.length; i += 4) {
    const batch = await Promise.allSettled(tasks.slice(i, i + 4).map(load => load()))
    for (const result of batch) {
      if (result.status !== 'fulfilled') continue
      for (const event of result.value) {
        const previous = events.get(event.id)
        // If the same account entered on both sides, the match cannot describe one opponent reliably.
        events.set(event.id, previous === undefined || previous?.title === event.title ? event : null)
      }
    }
    if (events.size > 1000) throw Error('Competition calendar too large')
  }
  const scoped = [...events.values()].filter(event => event !== null)
  if (!scoped.length) return []
  const ids = [...new Set(scoped.map(event => event.competitionId))]
  const responses = rows(await db.from('player_schedule_responses')
    .select('competition_kind,competition_id,event_id,response,event_snapshot,updated_at,player_user_id')
    .eq('player_user_id', owner).in('competition_id', ids).limit(501), 500)
  if (responses.some(response => response.player_user_id !== owner || !ids.includes(response.competition_id))) throw Error('Calendar owner changed')
  return applyCompetitionScheduleResponses(scoped, responses.filter(response => {
    const event = events.get(response.event_id)
    return event && event.kind === response.competition_kind && event.competitionId === response.competition_id
  }))
}
