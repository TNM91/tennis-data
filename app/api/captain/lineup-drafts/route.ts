import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { cleanAvailabilityText, getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import {
  getCaptainLineupDraftScopeKey,
  readCaptainLineupBuilderDraft,
  type CaptainLineupBuilderDraft,
} from '@/lib/captain-lineup-handoff'
import { canManageTeamRoom, normalizeTeamRoomKey } from '@/lib/team-room'
import { isCaptainLineupSummaryCurrent, summarizeCaptainLineupDraft } from '@/lib/captain-lineup-draft-summary'
import { todayDateKey } from '@/lib/team-room-match-flow'

export const runtime = 'nodejs'
export const maxDuration = 20

type DraftRequest = { draft?: unknown }
type DraftStatusRequest = {
  action?: unknown
  scope?: unknown
  status?: unknown
  teamSlots?: unknown
  selectedMatchId?: unknown
  matchFormat?: unknown
  matchDetails?: unknown
  updatedAt?: unknown
}

function readScope(source: URLSearchParams | Record<string, unknown>) {
  const get = (key: string) => source instanceof URLSearchParams ? source.get(key) : source[key]
  return {
    competitionLayer: cleanAvailabilityText(get('competitionLayer'), 24),
    teamName: cleanAvailabilityText(get('teamName'), 160),
    leagueName: cleanAvailabilityText(get('leagueName'), 160),
    flight: cleanAvailabilityText(get('flight'), 120),
    matchDate: cleanAvailabilityText(get('matchDate'), 10),
    opponentTeam: cleanAvailabilityText(get('opponentTeam'), 160),
  }
}

async function authorizeTeam(request: Request, teamName: string) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth
  if (!teamName) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Choose a team before saving this draft.' }, { status: 400 }) }
  }

  const service = getCaptainAvailabilityServiceClient()
  const { data, error } = await service
    .from('team_profile_links')
    .select('team_role,team_roles')
    .eq('profile_user_id', auth.userId)
    .eq('normalized_team_name', normalizeTeamRoomKey(teamName))
    .eq('status', 'accepted')
    .limit(10)
  if (error) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Captain team access could not be checked.' }, { status: 500 }) }
  }

  const canManage = auth.isAdmin || (data ?? []).some((link) => {
    const roles = Array.isArray(link.team_roles) && link.team_roles.length
      ? link.team_roles.map(String)
      : [String(link.team_role || 'player')]
    return canManageTeamRoom(roles)
  })
  if (!canManage) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Captain access is required for this team.' }, { status: 403 }) }
  }

  return { ok: true as const, auth, service }
}

function toDraft(row: Record<string, unknown> | null): CaptainLineupBuilderDraft | null {
  if (!row) return null
  return readCaptainLineupBuilderDraft(JSON.stringify({
    competitionLayer: row.competition_layer,
    teamName: row.team_name,
    leagueName: row.league_name,
    flight: row.flight,
    matchDate: row.match_date,
    opponentTeam: row.opponent_team,
    selectedMatchId: row.selected_match_id,
    matchFormat: row.match_format,
    scenarioId: row.scenario_id,
    scenarioName: row.scenario_name,
    notes: row.notes,
    teamSlots: row.slots_json,
    opponentSlots: row.opponent_slots_json,
    manualRosterEntries: row.manual_roster_entries,
    matchDetails: {
      location: row.match_location,
      directions: row.match_directions,
      arrivalTime: row.arrival_time,
      notes: row.captain_notes,
    },
    matchWeekUpdatedAt: row.match_week_updated_at,
    updatedAt: row.updated_at,
  }))
}

function cleanMatchWeekDetails(value: unknown) {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    location: cleanAvailabilityText(source.location, 240),
    directions: cleanAvailabilityText(source.directions, 600),
    arrivalTime: cleanAvailabilityText(source.arrivalTime, 80),
    notes: cleanAvailabilityText(source.notes, 1200),
  }
}

function cleanMatchWeekSlots(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 30).map((slot, index) => {
    const source = slot && typeof slot === 'object' ? slot as Record<string, unknown> : {}
    const slotType = source.slotType === 'doubles' ? 'doubles' : 'singles'
    const playerCount = slotType === 'doubles' ? 2 : 1
    const players = Array.isArray(source.players) ? source.players : []
    return {
      id: cleanAvailabilityText(source.id, 120) || `slot-${index + 1}`,
      label: cleanAvailabilityText(source.label, 120) || `Court ${index + 1}`,
      slotType,
      ...(typeof source.ratingLevel === 'number' && Number.isFinite(source.ratingLevel)
        ? { ratingLevel: source.ratingLevel }
        : {}),
      players: Array.from({ length: playerCount }, (_, playerIndex) => {
        const player = players[playerIndex]
        const entry = player && typeof player === 'object' ? player as Record<string, unknown> : {}
        return {
          playerId: cleanAvailabilityText(entry.playerId, 120),
          playerName: cleanAvailabilityText(entry.playerName, 160),
        }
      }),
    }
  })
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  if (searchParams.get('view') === 'summary') {
    const auth = await getCaptainApiAuth(request)
    if (!auth.ok) return auth.response
    const service = getCaptainAvailabilityServiceClient()
    const linksResult = auth.isAdmin
      ? { data: [], error: null }
      : await service
        .from('team_profile_links')
        .select('normalized_team_name,team_role,team_roles')
        .eq('profile_user_id', auth.userId)
        .eq('status', 'accepted')

    if (linksResult.error) {
      return Response.json({ ok: false, message: 'Your lineup access could not be checked.' }, { status: 500 })
    }

    const captainTeams = new Set((linksResult.data ?? []).filter((link) => {
      const roles = Array.isArray(link.team_roles) && link.team_roles.length
        ? link.team_roles.map(String)
        : [String(link.team_role || 'player')]
      return canManageTeamRoom(roles)
    }).map((link) => String(link.normalized_team_name || '')))

    const { data, error } = await service
      .from('captain_lineup_drafts')
      .select('competition_layer,team_name,league_name,flight,match_date,opponent_team,slots_json,status,updated_at')
      .eq('user_id', auth.userId)
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) return Response.json({ ok: false, message: 'Your active lineups could not be loaded.' }, { status: 500 })

    const today = todayDateKey()
    const summaries = (data ?? [])
      .filter((row) => auth.isAdmin || captainTeams.has(normalizeTeamRoomKey(String(row.team_name || ''))))
      .map((row) => summarizeCaptainLineupDraft(row))
      .filter((summary) => summary !== null && isCaptainLineupSummaryCurrent(summary, today))

    return Response.json({ ok: true, summaries }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  }

  const scope = readScope(searchParams)
  const authorized = await authorizeTeam(request, scope.teamName)
  if (!authorized.ok) return authorized.response

  const scopeKeys = scope.competitionLayer
    ? [getCaptainLineupDraftScopeKey(scope)]
    : ['', 'usta', 'tiq'].map((competitionLayer) => getCaptainLineupDraftScopeKey({ ...scope, competitionLayer }))
  let draftQuery = authorized.service
    .from('captain_lineup_drafts')
    .select('competition_layer,team_name,league_name,flight,match_date,opponent_team,selected_match_id,match_format,scenario_id,scenario_name,notes,slots_json,opponent_slots_json,manual_roster_entries,match_location,match_directions,arrival_time,captain_notes,match_week_updated_at,updated_at')
    .eq('user_id', authorized.auth.userId)
  draftQuery = scopeKeys.length === 1
    ? draftQuery.eq('scope_key', scopeKeys[0])
    : draftQuery.in('scope_key', scopeKeys)
  const { data, error } = await draftQuery
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return Response.json({ ok: false, message: 'Your in-progress lineup could not be loaded.' }, { status: 500 })

  return Response.json({ ok: true, draft: toDraft(data as Record<string, unknown> | null) }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function PUT(request: Request) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null) as DraftRequest | null
  const draft = readCaptainLineupBuilderDraft(JSON.stringify(body?.draft ?? null))
  if (!draft) return Response.json({ ok: false, message: 'This lineup draft is not valid.' }, { status: 400 })

  const authorized = await authorizeTeam(request, draft.teamName)
  if (!authorized.ok) return authorized.response
  if (authorized.auth.userId !== auth.userId) return Response.json({ ok: false, message: 'This lineup draft is not available.' }, { status: 403 })

  const scopeKey = getCaptainLineupDraftScopeKey(draft)
  const matchWeekUpdatedAt = draft.updatedAt || new Date().toISOString()
  const upsertRow: Record<string, unknown> = {
      user_id: auth.userId,
      scope_key: scopeKey,
      competition_layer: draft.competitionLayer,
      team_name: draft.teamName,
      league_name: draft.leagueName,
      flight: draft.flight,
      match_date: /^\d{4}-\d{2}-\d{2}$/.test(draft.matchDate) ? draft.matchDate : null,
      opponent_team: draft.opponentTeam,
      selected_match_id: draft.selectedMatchId,
      match_format: draft.matchFormat,
      scenario_id: draft.scenarioId || null,
      scenario_name: draft.scenarioName,
      notes: draft.notes,
      slots_json: draft.teamSlots,
      opponent_slots_json: draft.opponentSlots,
      manual_roster_entries: draft.manualRosterEntries,
      match_week_updated_at: matchWeekUpdatedAt,
      status: 'working',
      finalized_at: null,
      updated_at: matchWeekUpdatedAt,
  }
  if (draft.matchDetails) {
    const details = cleanMatchWeekDetails(draft.matchDetails)
    upsertRow.match_location = details.location
    upsertRow.match_directions = details.directions
    upsertRow.arrival_time = details.arrivalTime
    upsertRow.captain_notes = details.notes
  }

  const { data, error } = await authorized.service
    .from('captain_lineup_drafts')
    .upsert(upsertRow, { onConflict: 'user_id,scope_key' })
    .select('updated_at')
    .single()
  if (error) return Response.json({ ok: false, message: 'Your in-progress lineup could not be saved.' }, { status: 500 })

  return Response.json({ ok: true, updatedAt: data.updated_at })
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null) as DraftStatusRequest | null
  const scope = readScope(body?.scope && typeof body.scope === 'object' ? body.scope as Record<string, unknown> : {})
  if (body?.action === 'sync-match-week') {
    const authorized = await authorizeTeam(request, scope.teamName)
    if (!authorized.ok) return authorized.response
    const updatedAt = cleanAvailabilityText(body.updatedAt, 40)
    if (!/^\d{4}-\d{2}-\d{2}T/.test(updatedAt)) {
      return Response.json({ ok: false, message: 'This Match Week update is not valid.' }, { status: 400 })
    }

    const scopeKey = getCaptainLineupDraftScopeKey(scope)
    const { data: existing, error: readError } = await authorized.service
      .from('captain_lineup_drafts')
      .select('match_week_updated_at')
      .eq('user_id', authorized.auth.userId)
      .eq('scope_key', scopeKey)
      .maybeSingle()
    if (readError) return Response.json({ ok: false, message: 'Match Week could not be checked.' }, { status: 500 })

    const existingUpdatedAt = Date.parse(String(existing?.match_week_updated_at || '')) || 0
    if (existingUpdatedAt > (Date.parse(updatedAt) || 0)) {
      return Response.json({ ok: true, ignored: true, updatedAt: existing?.match_week_updated_at })
    }

    const details = cleanMatchWeekDetails(body.matchDetails)
    const row = {
      user_id: authorized.auth.userId,
      scope_key: scopeKey,
      competition_layer: scope.competitionLayer,
      team_name: scope.teamName,
      league_name: scope.leagueName,
      flight: scope.flight,
      match_date: /^\d{4}-\d{2}-\d{2}$/.test(scope.matchDate) ? scope.matchDate : null,
      opponent_team: scope.opponentTeam,
      selected_match_id: cleanAvailabilityText(body.selectedMatchId, 160),
      match_format: cleanAvailabilityText(body.matchFormat, 80) || 'auto',
      slots_json: cleanMatchWeekSlots(body.teamSlots),
      match_location: details.location,
      match_directions: details.directions,
      arrival_time: details.arrivalTime,
      captain_notes: details.notes,
      match_week_updated_at: updatedAt,
      updated_at: updatedAt,
    }
    const { error } = await authorized.service
      .from('captain_lineup_drafts')
      .upsert(row, { onConflict: 'user_id,scope_key' })
    if (error) return Response.json({ ok: false, message: 'Match Week could not be saved.' }, { status: 500 })

    return Response.json({ ok: true, updatedAt })
  }

  if (body?.status !== 'final') {
    return Response.json({ ok: false, message: 'This lineup status is not valid.' }, { status: 400 })
  }
  const authorized = await authorizeTeam(request, scope.teamName)
  if (!authorized.ok) return authorized.response

  const finalizedAt = new Date().toISOString()
  const { error } = await authorized.service
    .from('captain_lineup_drafts')
    .update({ status: 'final', finalized_at: finalizedAt, updated_at: finalizedAt })
    .eq('user_id', authorized.auth.userId)
    .eq('scope_key', getCaptainLineupDraftScopeKey(scope))
  if (error) return Response.json({ ok: false, message: 'This lineup could not be finalized.' }, { status: 500 })

  return Response.json({ ok: true, finalizedAt })
}

export async function DELETE(request: Request) {
  const scope = readScope(new URL(request.url).searchParams)
  const authorized = await authorizeTeam(request, scope.teamName)
  if (!authorized.ok) return authorized.response

  const { error } = await authorized.service
    .from('captain_lineup_drafts')
    .delete()
    .eq('user_id', authorized.auth.userId)
    .eq('scope_key', getCaptainLineupDraftScopeKey(scope))
  if (error) return Response.json({ ok: false, message: 'This draft could not be cleared.' }, { status: 500 })
  return Response.json({ ok: true })
}
