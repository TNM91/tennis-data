import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import {
  cleanAvailabilityText,
  getCaptainAvailabilityServiceClient,
  isUuid,
} from '@/lib/captain-availability-request-server'
import {
  authorizeSeason,
  loadSeasonRoster,
  seasonPrivateHeaders,
} from '@/lib/season-kickoff-server'

export const runtime = 'nodejs'
export const maxDuration = 20

type AvailabilityStatus = 'available' | 'unavailable' | 'tentative' | 'no-response'
type SeasonRosterPlayer = Awaited<ReturnType<typeof loadSeasonRoster>>[number]

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: seasonPrivateHeaders })

function readScope(values: { team?: unknown; league?: unknown; flight?: unknown; matchDate?: unknown }) {
  return {
    team: cleanAvailabilityText(values.team, 160),
    league: cleanAvailabilityText(values.league, 160),
    flight: cleanAvailabilityText(values.flight, 120),
    matchDate: cleanAvailabilityText(values.matchDate, 10),
  }
}

function validScope(scope: ReturnType<typeof readScope>) {
  return Boolean(scope.team && scope.league && scope.flight && /^\d{4}-\d{2}-\d{2}$/.test(scope.matchDate))
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function clientStatus(value: unknown): AvailabilityStatus {
  const status = String(value || '').trim().toLowerCase()
  if (status === 'limited' || status === 'maybe' || status === 'tentative') return 'tentative'
  if (status === 'available' || status === 'unavailable') return status
  return 'no-response'
}

function storedStatus(value: AvailabilityStatus) {
  return value === 'tentative' ? 'limited' : value
}

function safeUpdatedAt(value: unknown) {
  const now = Date.now()
  const parsed = Date.parse(String(value || ''))
  if (!Number.isFinite(parsed) || parsed > now + 5 * 60_000) return new Date(now).toISOString()
  return new Date(parsed).toISOString()
}

function findRosterPlayer(roster: SeasonRosterPlayer[], playerId: string, playerName: string) {
  if (isUuid(playerId)) return roster.find((player) => player.playerId === playerId) || null
  const matches = roster.filter((player) => normalizeName(player.name) === normalizeName(playerName))
  return matches.length === 1 ? matches[0] : null
}

export async function GET(request: Request) {
  try {
    const auth = await getCaptainApiAuth(request)
    if (!auth.ok) return auth.response

    const params = new URL(request.url).searchParams
    const scope = readScope({
      team: params.get('team'),
      league: params.get('league'),
      flight: params.get('flight'),
      matchDate: params.get('matchDate'),
    })
    if (!validScope(scope)) return json({ ok: false, message: 'Choose a team and match date.' }, 400)

    const service = getCaptainAvailabilityServiceClient()
    if (!await authorizeSeason(service, auth.userId, { ...scope, seasonKey: '' })) {
      return json({ ok: false, message: 'Captain access is required for this team and season.' }, 403)
    }

    const roster = await loadSeasonRoster(service, { ...scope, seasonKey: '' })
    const playerIds = roster.map((player) => player.playerId).filter((id): id is string => isUuid(id || ''))
    if (!playerIds.length) return json({ ok: true, availability: [], checkedAt: new Date().toISOString() })

    const result = await service
      .from('lineup_availability')
      .select('player_id,status,notes,updated_at')
      .eq('team_name', scope.team)
      .eq('league_name', scope.league)
      .eq('flight', scope.flight)
      .eq('match_date', scope.matchDate)
      .in('player_id', playerIds)
      .limit(251)
    if (result.error || (result.data?.length || 0) > 250) throw new Error('Availability unavailable')

    const playerById = new Map(roster.map((player) => [player.playerId, player]))
    return json({
      ok: true,
      availability: (result.data || []).flatMap((row) => {
        const player = playerById.get(row.player_id)
        return player ? [{
          playerId: player.playerId,
          playerName: player.name,
          status: clientStatus(row.status),
          note: cleanAvailabilityText(row.notes, 500),
          updatedAt: row.updated_at,
        }] : []
      }),
      checkedAt: new Date().toISOString(),
    })
  } catch {
    return json({ ok: false, message: 'Shared availability could not be loaded. Your phone copy is still available.' }, 503)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getCaptainApiAuth(request)
    if (!auth.ok) return auth.response
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return json({ ok: false, message: 'The availability update is incomplete.' }, 400)

    const scope = readScope(body)
    const playerId = cleanAvailabilityText(body.playerId, 80)
    const playerName = cleanAvailabilityText(body.playerName, 160)
    const requestedStatus = cleanAvailabilityText(body.status, 20)
    const status = clientStatus(requestedStatus)
    const note = cleanAvailabilityText(body.note, 500)
    const updatedAt = safeUpdatedAt(body.updatedAt)
    if (!validScope(scope) || !playerName || !['available', 'unavailable', 'tentative', 'no-response'].includes(requestedStatus)) {
      return json({ ok: false, message: 'Choose a roster player, match, and availability.' }, 400)
    }

    const service = getCaptainAvailabilityServiceClient()
    if (!await authorizeSeason(service, auth.userId, { ...scope, seasonKey: '' })) {
      return json({ ok: false, message: 'Captain access is required for this team and season.' }, 403)
    }

    const roster = await loadSeasonRoster(service, { ...scope, seasonKey: '' })
    const player = findRosterPlayer(roster, playerId, playerName)
    if (!player || !isUuid(player.playerId || '')) {
      return json({ ok: false, message: `${playerName} must be linked to the team roster before availability can sync.` }, 409)
    }

    const existingResult = await service
      .from('lineup_availability')
      .select('player_id,status,notes,updated_at')
      .eq('team_name', scope.team)
      .eq('league_name', scope.league)
      .eq('flight', scope.flight)
      .eq('match_date', scope.matchDate)
      .eq('player_id', player.playerId)
      .limit(2)
    if (existingResult.error || (existingResult.data?.length || 0) > 1) throw new Error('Availability conflict')
    const existing = existingResult.data?.[0]
    if (existing && Date.parse(existing.updated_at || '') > Date.parse(updatedAt)) {
      return json({
        ok: true,
        stale: true,
        availability: {
          playerId: player.playerId,
          playerName: player.name,
          status: clientStatus(existing.status),
          note: cleanAvailabilityText(existing.notes, 500),
          updatedAt: existing.updated_at,
        },
      })
    }

    if (status === 'no-response') {
      const result = await service
        .from('lineup_availability')
        .delete()
        .eq('team_name', scope.team)
        .eq('league_name', scope.league)
        .eq('flight', scope.flight)
        .eq('match_date', scope.matchDate)
        .eq('player_id', player.playerId)
      if (result.error) throw new Error('Availability delete failed')
      return json({ ok: true, availability: { playerId: player.playerId, playerName: player.name, status, note: '', updatedAt } })
    }

    const savedNote = note || 'Updated by captain in Messaging.'
    const result = await service.from('lineup_availability').upsert({
      match_date: scope.matchDate,
      team_name: scope.team,
      league_name: scope.league,
      flight: scope.flight,
      player_id: player.playerId,
      status: storedStatus(status),
      notes: savedNote,
      updated_at: updatedAt,
    }, { onConflict: 'match_date,team_name,player_id' })
    if (result.error) throw new Error('Availability save failed')

    return json({
      ok: true,
      availability: { playerId: player.playerId, playerName: player.name, status, note: savedNote, updatedAt },
    })
  } catch {
    return json({ ok: false, message: 'Shared availability could not be saved. It remains saved on this phone.' }, 503)
  }
}
