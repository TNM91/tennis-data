import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { getCache } from '@vercel/functions'
import { cleanAvailabilityText, getCaptainAvailabilityServiceClient, isUuid } from '@/lib/captain-availability-request-server'
import { normalizeTeamName } from '@/lib/captain-formatters'
import { normalizeCaptainRosterContactKey } from '@/lib/captain-roster-contacts'
import { canManageTeamRoom, normalizeTeamRoomKey } from '@/lib/team-room'

export const runtime = 'nodejs'
export const maxDuration = 20

const CAPTAIN_LINEUP_CACHE_TTL_SECONDS = 30

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

function resolveOptionalQuery<T>(
  label: string,
  query: PromiseLike<T>,
  fallback: T,
  timeoutMs = 2_500,
): Promise<T> {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      console.warn('[api/captain/lineup-builder] query timed out; using fallback', {
        query: label,
        timeoutMs,
        durationMs: Date.now() - startedAt,
      })
      resolve(fallback)
    }, timeoutMs)
    Promise.resolve(query)
      .then((result) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve(result)
      })
      .catch(() => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        console.warn('[api/captain/lineup-builder] query failed; using fallback', {
          query: label,
          durationMs: Date.now() - startedAt,
        })
        resolve(fallback)
      })
  })
}

export async function GET(request: Request) {
  const startedAt = Date.now()
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) {
    console.warn('[api/captain/lineup-builder] access denied', { durationMs: Date.now() - startedAt })
    return auth.response
  }

  const url = new URL(request.url)
  const teamName = cleanAvailabilityText(url.searchParams.get('team'), 160)
  const leagueName = cleanAvailabilityText(url.searchParams.get('league'), 160)
  const flight = cleanAvailabilityText(url.searchParams.get('flight'), 120)
  const opponentName = cleanAvailabilityText(url.searchParams.get('opponent'), 160)
  if (!teamName) {
    return Response.json({
      ok: true,
      players: [], matches: [], matchPlayers: [], historicalLineMatches: [], historicalLineMatchPlayers: [], rosterMembers: [], availability: [],
      captainRosterContacts: [], captainMessageContacts: [], savedScenarios: [], tiqTeamLeagueFormats: [],
    })
  }

  const service = getCaptainAvailabilityServiceClient()
  const normalizedTeam = normalizeTeamName(teamName)
  const normalizedContactTeam = normalizeCaptainRosterContactKey(teamName)
  const { data: teamLinks, error: teamLinksError } = await service
    .from('team_profile_links')
    .select('team_role,team_roles')
    .eq('profile_user_id', auth.userId)
    .eq('normalized_team_name', normalizeTeamRoomKey(teamName))
    .eq('status', 'accepted')
    .limit(10)
  if (teamLinksError) return Response.json({ ok: false, message: 'Captain team access could not be checked.' }, { status: 500 })
  const hasCaptainTeamLink = (teamLinks ?? []).some((link) => {
    const roles = Array.isArray(link.team_roles) && link.team_roles.length
      ? link.team_roles.map(String)
      : [String(link.team_role || 'player')]
    return canManageTeamRoom(roles)
  })
  // Platform Admin is verified by getCaptainApiAuth before this query runs.
  // A linked captain/co-captain remains required for every other account.
  const canManageSelectedTeam = auth.isAdmin || hasCaptainTeamLink
  if (!canManageSelectedTeam) {
    console.warn('[api/captain/lineup-builder] team management denied', {
      durationMs: Date.now() - startedAt,
      authorization: 'no-captain-team-link',
    })
    return Response.json({ ok: false, message: 'Captain access is required for this team.' }, { status: 403 })
  }
  console.info('[api/captain/lineup-builder] team management authorized', {
    durationMs: Date.now() - startedAt,
    authorization: auth.isAdmin ? 'platform-admin' : 'captain-team-link',
  })

  // The account and team role are always checked before this private response
  // is read. The cache only avoids re-running the same roster/schedule bundle
  // during a short mobile navigation session.
  const runtimeCache = getCache({ namespace: 'captain-lineup-builder' })
  const cacheKey = `${auth.userId}:${normalizeTeamRoomKey(teamName)}:${normalizeTeamRoomKey(leagueName)}:${normalizeTeamRoomKey(flight)}:${normalizeTeamRoomKey(opponentName)}`
  try {
    const cached = await runtimeCache.get(cacheKey) as Record<string, unknown> | undefined
    if (cached?.ok === true) {
      console.info('[api/captain/lineup-builder] cache hit', { durationMs: Date.now() - startedAt })
      return Response.json(cached, { headers: { 'Cache-Control': 'private, no-store' } })
    }
  } catch {
    // Runtime Cache is an optimization; a cache miss must not block lineup work.
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
  const historicalLineMatchesPromise = service
    .from('matches')
    .select('id,league_name,flight,match_date,match_time,facility,home_team,away_team,line_number')
    .not('line_number', 'is', null)
    .or(`home_team.eq."${escapedTeam}",away_team.eq."${escapedTeam}"`)
    .order('match_date', { ascending: false })
    .limit(360)
  const availabilityPromise = service
    .from('lineup_availability')
    .select('id,match_date,team_name,league_name,flight,player_id,status,notes')
    .eq('team_name', teamName)
    .order('match_date', { ascending: false })
    .limit(500)
  const contactsPromise = service
    .from('captain_roster_contacts')
    .select('*')
    .eq('captain_user_id', auth.userId)
    // Player Roster imports intentionally use the punctuation-insensitive
    // contact key. Query that same key so a slash, dash, or spacing variation
    // in the Builder URL cannot hide a saved mobile number.
    .eq('normalized_team_name', normalizedContactTeam)
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

  const emptyScenariosResult = {
    data: [],
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
    success: true,
  } as Awaited<typeof scenariosPromise>
  const emptyMatchesResult = {
    data: [],
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
    success: true,
  } as Awaited<typeof matchesPromise>
  const emptyAvailabilityResult = {
    data: [],
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
    success: true,
  } as Awaited<typeof availabilityPromise>
  const emptyContactsResult = {
    data: [],
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
    success: true,
  } as Awaited<typeof contactsPromise>
  const emptyFormatsResult = {
    data: [],
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
    success: true,
  } as Awaited<typeof formatsQuery>

  const [rosterResult, matchesResult, availabilityResult, contactsResult, formatsResult, scenariosResult] = await Promise.all([
    rosterPromise,
    // Match history and availability enrich the builder, but must never prevent a
    // captain from opening their saved team when the historical import is busy.
    resolveOptionalQuery('team schedule', matchesPromise, emptyMatchesResult, 3_500),
    resolveOptionalQuery('team availability', availabilityPromise, emptyAvailabilityResult, 3_500),
    resolveOptionalQuery('roster contacts', contactsPromise, emptyContactsResult),
    resolveOptionalQuery('team formats', formatsQuery, emptyFormatsResult),
    resolveOptionalQuery('saved scenarios', scenariosPromise, emptyScenariosResult),
  ])
  const historicalLineMatchesResult = await resolveOptionalQuery('historical court lineups', historicalLineMatchesPromise, emptyMatchesResult, 3_500)
  const primaryError = rosterResult.error
  if (primaryError) return Response.json({ ok: false, message: primaryError.message }, { status: 500 })

  // A captain can use an imported opponent Team Summary as a quick picker when
  // recording the final score. Returning only names keeps this scoped to the
  // match workflow while still allowing an unlisted player to be typed in.
  const opponentRosterRows = opponentName
    ? await resolveOptionalQuery(
      'opponent roster',
      service
        .from('team_roster_members')
        .select('player_name')
        .eq('normalized_team_name', normalizeTeamName(opponentName))
        .limit(250)
        .then((result) => result.data || []),
      [] as Array<{ player_name: string | null }>,
    )
    : []
  const opponentRosterNames = [...new Set(opponentRosterRows
    .map((row) => cleanAvailabilityText(row.player_name, 160))
    .filter(Boolean))].sort((left, right) => left.localeCompare(right))

  const rosterMembers = rosterResult.data ?? []
  const historicalLineMatches = (historicalLineMatchesResult.data ?? []).filter((match) => {
    if (!opponentName) return true
    const home = normalizeTeamName(match.home_team)
    const away = normalizeTeamName(match.away_team)
    const normalizedOpponent = normalizeTeamName(opponentName)
    return home === normalizedOpponent || away === normalizedOpponent
  })
  const rosterPlayerIds = Array.from(new Set(rosterMembers.map((row) => row.player_id).filter((id): id is string => Boolean(id))))
  const matchIds = (matchesResult.data ?? []).map((match) => match.id)
  const matchPlayersResultPromise = matchIds.length
    ? service.from('match_players').select('match_id,player_id,side,seat').in('match_id', matchIds).limit(1200)
    : Promise.resolve({ data: [], error: null })
  const historicalLineMatchIds = historicalLineMatches.map((match) => match.id)
  const historicalLineMatchPlayersResultPromise = historicalLineMatchIds.length
    ? service.from('match_players').select('match_id,player_id,side,seat').in('match_id', historicalLineMatchIds).limit(2400)
    : Promise.resolve({ data: [], error: null })
  const emptyMatchPlayersResult = {
    data: [],
    error: null,
    count: null,
    status: 200,
    statusText: 'OK',
    success: true,
  } as Awaited<typeof matchPlayersResultPromise>
  const [matchPlayersResult, historicalLineMatchPlayersResult] = await Promise.all([
    resolveOptionalQuery('scheduled match players', matchPlayersResultPromise, emptyMatchPlayersResult, 3_500),
    resolveOptionalQuery('historical lineup players', historicalLineMatchPlayersResultPromise, emptyMatchPlayersResult, 3_500),
  ])
  const historicalPlayerIds = Array.from(new Set((historicalLineMatchPlayersResult.data ?? []).map((row) => row.player_id).filter((id): id is string => Boolean(id))))
  const playerIds = Array.from(new Set([...rosterPlayerIds, ...historicalPlayerIds]))
  const playersResult = playerIds.length
    ? await service.from('players').select(PLAYER_ROSTER_SELECT).in('id', playerIds).order('name', { ascending: true })
    : { data: [], error: null }
  if (playersResult.error) {
    return Response.json({ ok: false, message: playersResult.error.message || 'Lineup data is unavailable.' }, { status: 500 })
  }

  console.info('[api/captain/lineup-builder] loaded', {
    durationMs: Date.now() - startedAt,
    rosterCount: rosterMembers.length,
    matchCount: matchesResult.data?.length ?? 0,
  })
  const payload = {
    ok: true,
    players: playersResult.data ?? [],
    opponentRosterNames,
    matches: matchesResult.data ?? [],
    matchPlayers: matchPlayersResult.data ?? [],
    historicalLineMatches,
    historicalLineMatchPlayers: historicalLineMatchPlayersResult.data ?? [],
    rosterMembers,
    availability: availabilityResult.data ?? [],
    captainRosterContacts: contactsResult.error ? [] : contactsResult.data ?? [],
    // Player Roster is the single source of contact data. Keeping the legacy
    // message-contact collection out of this path prevents a missing optional
    // table from slowing or blocking the Builder.
    captainMessageContacts: [],
    savedScenarios: scenariosResult.data ?? [],
    tiqTeamLeagueFormats: formatsResult.error ? [] : formatsResult.data ?? [],
  }
  try {
    await runtimeCache.set(cacheKey, payload, {
      ttl: CAPTAIN_LINEUP_CACHE_TTL_SECONDS,
      tags: [`captain-lineup:${auth.userId}:${normalizeTeamRoomKey(teamName)}`],
      name: 'captain-lineup-builder',
    })
  } catch {
    // The direct response remains authoritative if Runtime Cache is unavailable.
  }
  return Response.json(payload, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const teamName = cleanAvailabilityText(body?.teamName, 160)
  const leagueName = cleanAvailabilityText(body?.leagueName, 160)
  const flight = cleanAvailabilityText(body?.flight, 120)
  const matchDate = cleanAvailabilityText(body?.matchDate, 10)
  const playerId = cleanAvailabilityText(body?.playerId, 80)
  if (!teamName || !/^\d{4}-\d{2}-\d{2}$/.test(matchDate) || !isUuid(playerId)) {
    return Response.json({ ok: false, message: 'Choose a valid team, match, and roster player before confirming availability.' }, { status: 400 })
  }

  const service = getCaptainAvailabilityServiceClient()
  const { data: teamLinks, error: teamLinksError } = await service
    .from('team_profile_links')
    .select('team_role,team_roles')
    .eq('profile_user_id', auth.userId)
    .eq('normalized_team_name', normalizeTeamRoomKey(teamName))
    .eq('status', 'accepted')
    .limit(10)
  if (teamLinksError) return Response.json({ ok: false, message: 'Captain team access could not be checked.' }, { status: 500 })

  const canManageSelectedTeam = auth.isAdmin || (teamLinks ?? []).some((link) => {
    const roles = Array.isArray(link.team_roles) && link.team_roles.length
      ? link.team_roles.map(String)
      : [String(link.team_role || 'player')]
    return canManageTeamRoom(roles)
  })
  if (!canManageSelectedTeam) return Response.json({ ok: false, message: 'Captain access is required for this team.' }, { status: 403 })

  const { data, error } = await service
    .from('lineup_availability')
    .upsert({
      match_date: matchDate,
      team_name: teamName,
      league_name: leagueName || null,
      flight: flight || null,
      player_id: playerId,
      status: 'available',
      notes: 'Confirmed by captain from Lineup Builder.',
    }, { onConflict: 'match_date,team_name,player_id' })
    .select('id,match_date,team_name,league_name,flight,player_id,status,notes')
    .single()
  if (error) return Response.json({ ok: false, message: error.message || 'Availability could not be saved.' }, { status: 500 })

  return Response.json({ ok: true, availability: data })
}
