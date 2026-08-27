import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { cleanAvailabilityText, getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import { normalizeTeamName } from '@/lib/captain-formatters'
import { canManageTeamRoom, normalizeTeamRoomKey } from '@/lib/team-room'

export const runtime = 'nodejs'
export const maxDuration = 20

const PLAYER_ROSTER_SELECT = `
  id,
  name,
  location,
  flight,
  preferred_role,
  lineup_notes,
  singles_rating,
  singles_dynamic_rating,
  singles_usta_dynamic_rating,
  doubles_rating,
  doubles_dynamic_rating,
  doubles_usta_dynamic_rating,
  overall_rating,
  overall_dynamic_rating,
  overall_usta_dynamic_rating,
  rating_source,
  mixed_pair_role
`

function escapePostgrestValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function GET(request: Request) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const teamName = cleanAvailabilityText(url.searchParams.get('team'), 160)
  const leagueName = cleanAvailabilityText(url.searchParams.get('league'), 160)
  const flight = cleanAvailabilityText(url.searchParams.get('flight'), 120)
  if (!teamName) {
    return Response.json({
      ok: true,
      players: [], matches: [], matchPlayers: [], rosterMembers: [], availability: [],
      captainRosterContacts: [], captainMessageContacts: [], savedScenarios: [], tiqTeamLeagueFormats: [],
    })
  }

  const service = getCaptainAvailabilityServiceClient()
  const normalizedTeam = normalizeTeamName(teamName)
  const { data: teamLinks, error: teamLinksError } = await service
    .from('team_profile_links')
    .select('team_role,team_roles')
    .eq('profile_user_id', auth.userId)
    .eq('normalized_team_name', normalizeTeamRoomKey(teamName))
    .eq('status', 'accepted')
    .limit(10)
  if (teamLinksError) return Response.json({ ok: false, message: 'Captain team access could not be checked.' }, { status: 500 })
  const canManageSelectedTeam = (teamLinks ?? []).some((link) => {
    const roles = Array.isArray(link.team_roles) && link.team_roles.length
      ? link.team_roles.map(String)
      : [String(link.team_role || 'player')]
    return canManageTeamRoom(roles)
  })
  if (!canManageSelectedTeam) {
    return Response.json({ ok: false, message: 'Captain access is required for this team.' }, { status: 403 })
  }
  const escapedTeam = escapePostgrestValue(teamName)
  const rosterPromise = service
    .from('team_roster_members')
    .select('team_name,player_id,player_name,league_name,flight,rating_source,mixed_pair_role,age_division')
    .eq('normalized_team_name', normalizedTeam)
    .limit(250)
  const matchesPromise = service
    .from('matches')
    .select('id,league_name,flight,match_date,match_time,facility,home_team,away_team,line_number')
    .is('line_number', null)
    .or(`home_team.eq."${escapedTeam}",away_team.eq."${escapedTeam}"`)
    .order('match_date', { ascending: false })
    .limit(120)
  const availabilityPromise = service
    .from('lineup_availability')
    .select('id,match_date,team_name,league_name,flight,player_id,status,notes')
    .eq('team_name', teamName)
    .order('match_date', { ascending: false })
    .limit(500)
  const contactsPromise = service
    .from('captain_roster_contacts')
    .select('*')
    .eq('team_name', teamName)
    .order('full_name', { ascending: true })
    .limit(250)
  const textContactsPromise = service
    .from('captain_message_contacts')
    .select('team_name,league_name,flight,full_name,phone,opt_in_text')
    .eq('team_name', teamName)
    .order('full_name', { ascending: true })
    .limit(250)
  const scenariosPromise = service
    .from('lineup_scenarios')
    .select('id,scenario_name,league_name,flight,match_date,team_name,opponent_team,slots_json,opponent_slots_json,notes')
    .eq('team_name', teamName)
    .order('match_date', { ascending: false })
    .order('scenario_name', { ascending: true })
    .limit(100)
  let formatsQuery = service
    .from('tiq_leagues')
    .select('league_name,flight,team_match_format_id,competition_rules')
    .eq('league_format', 'team')
    .limit(30)
  if (leagueName) formatsQuery = formatsQuery.eq('league_name', leagueName)
  if (flight) formatsQuery = formatsQuery.eq('flight', flight)

  const [rosterResult, matchesResult, availabilityResult, contactsResult, textContactsResult, scenariosResult, formatsResult] = await Promise.all([
    rosterPromise, matchesPromise, availabilityPromise, contactsPromise, textContactsPromise, scenariosPromise, formatsQuery,
  ])
  const primaryError = rosterResult.error ?? matchesResult.error ?? availabilityResult.error ?? scenariosResult.error
  if (primaryError) return Response.json({ ok: false, message: primaryError.message }, { status: 500 })

  const rosterMembers = rosterResult.data ?? []
  const rosterPlayerIds = Array.from(new Set(rosterMembers.map((row) => row.player_id).filter((id): id is string => Boolean(id))))
  const matchIds = (matchesResult.data ?? []).map((match) => match.id)
  const [playersResult, matchPlayersResult] = await Promise.all([
    rosterPlayerIds.length
      ? service.from('players').select(PLAYER_ROSTER_SELECT).in('id', rosterPlayerIds).order('name', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    matchIds.length
      ? service.from('match_players').select('match_id,player_id,side').in('match_id', matchIds).limit(1200)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (playersResult.error || matchPlayersResult.error) {
    return Response.json({ ok: false, message: playersResult.error?.message || matchPlayersResult.error?.message || 'Lineup data is unavailable.' }, { status: 500 })
  }

  return Response.json({
    ok: true,
    players: playersResult.data ?? [],
    matches: matchesResult.data ?? [],
    matchPlayers: matchPlayersResult.data ?? [],
    rosterMembers,
    availability: availabilityResult.data ?? [],
    captainRosterContacts: contactsResult.error ? [] : contactsResult.data ?? [],
    captainMessageContacts: textContactsResult.error ? [] : textContactsResult.data ?? [],
    savedScenarios: scenariosResult.data ?? [],
    tiqTeamLeagueFormats: formatsResult.error ? [] : formatsResult.data ?? [],
  })
}
