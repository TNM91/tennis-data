import { randomUUID } from 'node:crypto'

import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { cleanAvailabilityText, getCaptainAvailabilityServiceClient, isUuid } from '@/lib/captain-availability-request-server'
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
  if (isUuid(contactId)) {
    const { data: existingContact, error: existingContactError } = await service
      .from('captain_message_contacts')
      .select('id,team_name')
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

    if (!existingContact) {
      return Response.json({ ok: false, message: 'That contact is no longer available. Refresh the roster and try again.' }, { status: 404 })
    }

    if (normalizeTeamRoomKey(existingContact.team_name) !== normalizeTeamRoomKey(teamName)) {
      return Response.json({ ok: false, message: 'That contact does not belong to this team.' }, { status: 403 })
    }
  }

  const contactPayload = {
    team_name: teamName,
    league_name: leagueName || null,
    flight: flight || null,
    season_label: null,
    session_label: null,
    full_name: fullName,
    phone,
    role: cleanAvailabilityText(body.role, 80) || 'Player',
    is_captain: body.isCaptain === true,
    is_active: true,
    opt_in_text: true,
    notes: null,
  }
  const select = 'id,team_name,league_name,flight,full_name,phone,role,is_captain'
  const saveResult = isUuid(contactId)
    ? await service.from('captain_message_contacts').update(contactPayload).eq('id', contactId).select(select).maybeSingle()
    : await service.from('captain_message_contacts').insert({ id: randomUUID(), ...contactPayload }).select(select).single()

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
