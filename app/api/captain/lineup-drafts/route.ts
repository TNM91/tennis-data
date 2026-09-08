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
type DraftStatusRequest = { scope?: unknown; status?: unknown }

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
    updatedAt: row.updated_at,
  }))
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

  const scopeKey = getCaptainLineupDraftScopeKey(scope)
  const { data, error } = await authorized.service
    .from('captain_lineup_drafts')
    .select('competition_layer,team_name,league_name,flight,match_date,opponent_team,selected_match_id,match_format,scenario_id,scenario_name,notes,slots_json,opponent_slots_json,manual_roster_entries,updated_at')
    .eq('user_id', authorized.auth.userId)
    .eq('scope_key', scopeKey)
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
  const { data, error } = await authorized.service
    .from('captain_lineup_drafts')
    .upsert({
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
      status: 'working',
      finalized_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,scope_key' })
    .select('updated_at')
    .single()
  if (error) return Response.json({ ok: false, message: 'Your in-progress lineup could not be saved.' }, { status: 500 })

  return Response.json({ ok: true, updatedAt: data.updated_at })
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null) as DraftStatusRequest | null
  const scope = readScope(body?.scope && typeof body.scope === 'object' ? body.scope as Record<string, unknown> : {})
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
