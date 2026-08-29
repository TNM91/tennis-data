import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { cleanAvailabilityText, getCaptainAvailabilityServiceClient, isUuid } from '@/lib/captain-availability-request-server'
import { CAPTAIN_ROSTER_CONTACTS_TABLE, normalizeCaptainRosterContactKey } from '@/lib/captain-roster-contacts'
import { canManageTeamRoom, normalizeTeamRoomKey } from '@/lib/team-room'

export const runtime = 'nodejs'

type TeamContactBody = {
  contactId?: unknown
  teamName?: unknown
  leagueName?: unknown
  flight?: unknown
  fullName?: unknown
  phone?: unknown
  role?: unknown
  isCaptain?: unknown
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response

  let body: TeamContactBody
  try {
    body = await request.json() as TeamContactBody
  } catch {
    return Response.json({ ok: false, message: 'Enter a mobile number and try again.' }, { status: 400 })
  }

  const teamName = cleanAvailabilityText(body.teamName)
  const leagueName = cleanAvailabilityText(body.leagueName)
  const flight = cleanAvailabilityText(body.flight)
  const fullName = cleanAvailabilityText(body.fullName)
  const phone = cleanAvailabilityText(body.phone, 48)
  const digits = phone.replace(/\D/g, '')
  if (!teamName || !fullName || digits.length < 10) {
    return Response.json({ ok: false, message: 'Enter a valid mobile number before saving.' }, { status: 400 })
  }

  let service: ReturnType<typeof getCaptainAvailabilityServiceClient>
  try {
    service = getCaptainAvailabilityServiceClient()
  } catch (error) {
    console.error('[api/captain/team-contacts] service unavailable', {
      durationMs: Date.now() - startedAt,
      userId: auth.userId,
      message: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, message: 'Team contacts are not ready to save right now. Please try again shortly.' }, { status: 503 })
  }

  if (!auth.isAdmin) {
    const { data: links, error: linksError } = await service
      .from('team_profile_links')
      .select('team_role,team_roles')
      .eq('profile_user_id', auth.userId)
      .eq('normalized_team_name', normalizeTeamRoomKey(teamName))
      .eq('status', 'accepted')
      .limit(10)

    if (linksError) {
      console.error('[api/captain/team-contacts] team access lookup failed', {
        durationMs: Date.now() - startedAt,
        userId: auth.userId,
        message: linksError.message,
      })
      return Response.json({ ok: false, message: 'Team access could not be checked. Please try again.' }, { status: 500 })
    }

    const canManageTeam = (links ?? []).some((link) => {
      const roles = Array.isArray(link.team_roles) && link.team_roles.length
        ? link.team_roles.map(String)
        : [String(link.team_role || 'player')]
      return canManageTeamRoom(roles)
    })
    if (!canManageTeam) {
      return Response.json({ ok: false, message: 'Captain access is required for this team.' }, { status: 403 })
    }
  }

  const contactId = cleanAvailabilityText(body.contactId, 80)
  let existingContact: {
    id: string
    team_name: string
    captain_user_id: string
    email: string | null
    source: string | null
    source_batch_id: string | null
  } | null = null
  if (isUuid(contactId)) {
    const { data, error: existingContactError } = await service
      .from(CAPTAIN_ROSTER_CONTACTS_TABLE)
      .select('id,team_name,captain_user_id,email,source,source_batch_id')
      .eq('id', contactId)
      .maybeSingle()

    if (existingContactError) {
      console.error('[api/captain/team-contacts] contact scope lookup failed', {
        durationMs: Date.now() - startedAt,
        userId: auth.userId,
        message: existingContactError.message,
      })
      return Response.json({ ok: false, message: 'That contact could not be checked. Please try again.' }, { status: 500 })
    }

    if (!data) {
      return Response.json({ ok: false, message: 'That contact is no longer available. Refresh the roster and try again.' }, { status: 404 })
    }

    if (normalizeTeamRoomKey(data.team_name) !== normalizeTeamRoomKey(teamName)) {
      return Response.json({ ok: false, message: 'That contact does not belong to this team.' }, { status: 403 })
    }

    if (!auth.isAdmin && data.captain_user_id !== auth.userId) {
      return Response.json({ ok: false, message: 'You can only update contacts for your own roster.' }, { status: 403 })
    }

    existingContact = data
  }

  const contactPayload = {
    captain_user_id: existingContact?.captain_user_id || auth.userId,
    team_name: teamName,
    normalized_team_name: normalizeCaptainRosterContactKey(teamName),
    league_name: leagueName,
    flight,
    full_name: fullName,
    normalized_name: normalizeCaptainRosterContactKey(fullName),
    phone,
    email: existingContact?.email || '',
    role: cleanAvailabilityText(body.role, 80) || 'Player',
    is_captain: body.isCaptain === true,
    source: existingContact?.source || 'captain_manual_entry',
    source_batch_id: existingContact?.source_batch_id || null,
  }
  const select = 'id,captain_user_id,team_name,normalized_team_name,league_name,flight,full_name,normalized_name,phone,email,role,is_captain,source,source_batch_id'
  const saveResult = isUuid(contactId)
    ? await service.from(CAPTAIN_ROSTER_CONTACTS_TABLE).update(contactPayload).eq('id', contactId).select(select).maybeSingle()
    : await service.from(CAPTAIN_ROSTER_CONTACTS_TABLE).upsert(contactPayload, {
        onConflict: 'captain_user_id,normalized_team_name,normalized_name,league_name,flight',
      }).select(select).maybeSingle()

  if (saveResult.error || !saveResult.data) {
    console.error('[api/captain/team-contacts] contact save failed', {
      durationMs: Date.now() - startedAt,
      userId: auth.userId,
      hasExistingContact: isUuid(contactId),
      message: saveResult.error?.message || 'No saved contact returned.',
      code: saveResult.error?.code || '',
    })
    return Response.json({ ok: false, message: 'That mobile number could not be saved. Please try again.' }, { status: 500 })
  }

  console.info('[api/captain/team-contacts] contact saved', {
    durationMs: Date.now() - startedAt,
    userId: auth.userId,
    existingContact: isUuid(contactId),
  })
  return Response.json({ ok: true, contact: saveResult.data })
}
