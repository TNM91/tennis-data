import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import { authorizeSeason, loadSeasonRoster, loadSeasonInvites, seasonPrivateHeaders, seasonToday } from '@/lib/season-kickoff-server'
import { currentSeasonReplies } from '@/lib/season-kickoff'
import { buildTeamSeasonCalendars } from '@/lib/team-season-calendar'
import { normalizeScheduleCalendarTime } from '@/lib/team-schedule-calendar'
import { selectedLineupPlayers, summarizeTeamAvailability, type AvailabilitySummaryAnswer } from '@/lib/team-availability-summary'

export const runtime = 'nodejs'
export const maxDuration = 30
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: seasonPrivateHeaders })

export async function GET(request: Request) {
  try {
    const auth = await getCaptainApiAuth(request)
    if (!auth.ok) return auth.response
    const params = new URL(request.url).searchParams
    const scope = { team: params.get('team')?.trim() || '', league: params.get('league')?.trim() || '', flight: params.get('flight')?.trim() || '', seasonKey: '' }
    const date = params.get('date') || '', opponent = params.get('opponent') || '', competitionLayer = params.get('layer')?.trim() || ''
    if (!scope.team || !scope.league || !opponent || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < seasonToday()
      || [...Object.values(scope), opponent].some(value => value.length > 500)) return json({ message: 'Choose an upcoming match and team.' }, 400)
    const service = getCaptainAvailabilityServiceClient()
    if (!await authorizeSeason(service, auth.userId, scope)) return json({ message: 'Captain access is required for this team and season.' }, 403)
    const escaped = scope.team.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const fixtureResult = await service.from('matches')
      .select('id,home_team,away_team,league_name,flight,match_date,match_time,facility,line_number,match_type,status')
      .eq('league_name', scope.league).eq('flight', scope.flight).eq('match_date', date).is('line_number', null)
      .or(`home_team.eq."${escaped}",away_team.eq."${escaped}"`).limit(51)
    if (fixtureResult.error || (fixtureResult.data?.length || 0) > 50) throw new Error('Schedule unavailable')
    const fixtures = buildTeamSeasonCalendars(scope.team, fixtureResult.data || [], '').flatMap(season => season.matches)
    const matching = fixtures.filter(match => (match.home_team === scope.team ? match.away_team : match.home_team) === opponent)
    if (matching.length !== 1) return json({ message: 'Open the schedule to choose the match. We won’t combine different fixtures.' }, 409)
    const match = matching[0]
    scope.seasonKey = buildTeamSeasonCalendars(scope.team, [match], '')[0].key
    let draftQuery = service.from('captain_lineup_drafts').select('scenario_id,slots_json,updated_at')
      .eq('user_id', auth.userId).eq('team_name', scope.team).eq('league_name', scope.league).eq('flight', scope.flight)
      .eq('match_date', date).eq('opponent_team', opponent)
    if (competitionLayer) draftQuery = draftQuery.eq('competition_layer', competitionLayer)
    const [roster, invites, saved, scenarios, requests, drafts] = await Promise.all([
      loadSeasonRoster(service, scope), loadSeasonInvites(service, scope),
      service.from('lineup_availability').select('player_id,status,notes,updated_at').eq('team_name', scope.team).eq('league_name', scope.league).eq('flight', scope.flight).eq('match_date', date).limit(251),
      service.from('lineup_scenarios').select('id,slots_json').eq('team_name', scope.team).eq('league_name', scope.league).eq('flight', scope.flight).eq('match_date', date).eq('opponent_team', opponent).limit(3),
      service.from('captain_availability_requests').select('id,match_time').eq('team_name', scope.team).eq('league_name', scope.league).eq('flight', scope.flight).eq('match_date', date).eq('opponent_team', opponent).gt('expires_at', new Date().toISOString()).limit(51),
      draftQuery.order('updated_at', { ascending: false }).limit(2),
    ])
    if (saved.error || scenarios.error || requests.error || drafts.error || (saved.data?.length || 0) > 250 || (requests.data?.length || 0) > 50) throw new Error('Replies unavailable')
    const ids = (requests.data || []).filter(row => normalizeScheduleCalendarTime(row.match_time) === normalizeScheduleCalendarTime(match.match_time)).map(row => row.id)
    const active = invites.filter(invite => !invite.revoked_at && invite.match_ids.includes(match.id))
    const [direct, seasonResult] = await Promise.all([
      ids.length ? service.from('captain_availability_request_responses').select('player_id,status,responded_at').in('request_id', ids).eq('match_date', date).limit(501) : { data: [], error: null },
      active.length ? service.from('season_availability_responses').select('invite_id,match_id,status,match_date,match_time,responded_at').in('invite_id', active.map(invite => invite.id)).eq('match_id', match.id).limit(251) : { data: [], error: null },
    ])
    if (direct.error || seasonResult.error || (direct.data?.length || 0) > 500 || (seasonResult.data?.length || 0) > 250) throw new Error('Replies incomplete')
    const answers: AvailabilitySummaryAnswer[] = [
      ...currentSeasonReplies([match], seasonResult.data || []).flatMap(row => {
        const invite = active.find(invite => invite.id === row.invite_id)
        return invite ? [{ playerId: invite.player_id || `roster:${invite.roster_key}`, status: row.status, at: row.responded_at, source: 'season' as const }] : []
      }),
      ...(direct.data || []).map(row => ({ playerId: row.player_id || '', status: row.status, at: row.responded_at, source: 'player' as const })),
    ]
    // Legacy day-scoped confirmations cannot safely identify either fixture
    // on a double-header. Keep fixture-specific replies and flag that omission.
    if (fixtures.length === 1) for (const row of saved.data || []) {
      const playerReply = (direct.data || []).some(reply => reply.player_id === row.player_id
        && (reply.status === row.status || (reply.status === 'maybe' && row.status === 'limited'))
        && Math.abs(Date.parse(reply.responded_at) - Date.parse(row.updated_at)) < 10000)
      answers.push({ playerId: row.player_id, status: row.status, at: row.updated_at,
        source: playerReply ? 'player' : row.notes === 'Confirmed by captain from Lineup Builder.' ? 'captain' : 'saved' })
    }
    const draftSelection = (drafts.data || []).find(row => selectedLineupPlayers(row.slots_json).length)
    const savedSelection = scenarios.data?.length === 1 ? scenarios.data[0] : null
    const selectedIds = draftSelection
      ? selectedLineupPlayers(draftSelection.slots_json)
      : savedSelection ? selectedLineupPlayers(savedSelection.slots_json) : null
    return json({ summary: summarizeTeamAvailability(roster, answers, selectedIds),
      selection: draftSelection ? 'draft' : savedSelection ? 'saved' : scenarios.data?.length ? 'choose' : 'none',
      scenarioId: draftSelection?.scenario_id || savedSelection?.id || '',
      match, scope, dayScopedAnswersOmitted: fixtures.length > 1, checkedAt: new Date().toISOString() })
  } catch {
    return json({ message: 'Availability could not be checked. Retry to see current answers.' }, 503)
  }
}
