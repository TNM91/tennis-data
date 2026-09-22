import { getClubApiAuth } from '@/lib/club-api-auth'
import {
  buildClinicSessionRows,
  canCoachClinic,
  canManageClinic,
  mapClubClinicAttendanceRow,
  mapClubClinicMessageRow,
  mapClubClinicRow,
  mapClubClinicSessionRow,
  normalizeClinicAttendanceStatus,
  normalizeClinicCapacity,
  normalizeClinicDuration,
  normalizeClinicExternalUrl,
  normalizeClinicMessageKind,
  normalizeClinicRosterStatus,
} from '@/lib/club-clinics'
import { cleanClubMultiline, cleanClubText, mapClubMembershipRow, mapClubRow } from '@/lib/club-workspace'

export const runtime = 'nodejs'

const groupSelect = 'id,club_id,name,group_type,description,season_label,lead_user_id,capacity,location_label,registration_url,default_duration_minutes,is_public,is_active,updated_at'
const membershipSelect = 'id,club_id,user_id,roles,status,display_name,email,phone,joined_at,updated_at'
const sessionSelect = 'id,group_id,title,starts_at,ends_at,location_label,court_label,focus,plan,player_next_step,status'

export async function GET(request: Request, context: { params: Promise<{ clubId: string; groupId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId, groupId } = await context.params

  const [clubResult, currentResult, memberResult, groupResult, rosterResult, sessionResult, messageResult] = await Promise.all([
    auth.supabase.from('clubs').select('id,owner_user_id,name,slug,description,logo_url,hero_image_url,primary_color,location_label,contact_email,time_zone,is_public,created_at,updated_at').eq('id', clubId).maybeSingle(),
    auth.supabase.from('club_memberships').select(membershipSelect).eq('club_id', clubId).eq('user_id', auth.userId).eq('status', 'active').maybeSingle(),
    auth.supabase.from('club_memberships').select(membershipSelect).eq('club_id', clubId).neq('status', 'removed').order('display_name'),
    auth.supabase.from('club_groups').select(groupSelect).eq('id', groupId).eq('club_id', clubId).eq('group_type', 'clinic').eq('is_active', true).maybeSingle(),
    auth.supabase.from('club_group_members').select('group_id,membership_id,status').eq('group_id', groupId),
    auth.supabase.from('club_clinic_sessions').select(sessionSelect).eq('group_id', groupId).order('starts_at'),
    auth.supabase.from('club_group_messages').select('id,group_id,author_name,body,kind,created_at').eq('group_id', groupId).order('created_at', { ascending: false }).limit(80),
  ])

  const firstError = [clubResult.error, currentResult.error, memberResult.error, groupResult.error, rosterResult.error, sessionResult.error, messageResult.error].find(Boolean)
  if (firstError) return clinicDatabaseError(firstError.message)
  if (!clubResult.data || !currentResult.data) return Response.json({ ok: false, message: 'This club is not linked to your profile.' }, { status: 403 })
  if (!groupResult.data) return Response.json({ ok: false, message: 'Clinic not found.' }, { status: 404 })

  const memberships = ((memberResult.data ?? []) as Record<string, unknown>[]).map(mapClubMembershipRow)
  const rosterStatusById = new Map(
    ((rosterResult.data ?? []) as Record<string, unknown>[]).map((row) => [cleanClubText(row.membership_id), normalizeClinicRosterStatus(row.status)]),
  )
  const groupRow = groupResult.data as Record<string, unknown>
  const leadCoach = memberships.find((membership) => membership.userId === cleanClubText(groupRow.lead_user_id))
  const sessions = ((sessionResult.data ?? []) as Record<string, unknown>[]).map(mapClubClinicSessionRow)
  let attendanceRows: Record<string, unknown>[] = []
  if (sessions.length) {
    const attendanceResult = await auth.supabase
      .from('club_clinic_attendance')
      .select('session_id,membership_id,status,note')
      .in('session_id', sessions.map((session) => session.id))
    if (attendanceResult.error) return clinicDatabaseError(attendanceResult.error.message)
    attendanceRows = (attendanceResult.data ?? []) as Record<string, unknown>[]
  }

  return Response.json({
    ok: true,
    workspace: {
      club: mapClubRow(clubResult.data as Record<string, unknown>),
      clinic: mapClubClinicRow({ ...groupRow, lead_coach_name: leadCoach?.displayName || leadCoach?.email || '' }),
      currentMembership: mapClubMembershipRow(currentResult.data as Record<string, unknown>),
      roster: memberships.map((membership) => ({
        ...membership,
        rosterStatus: rosterStatusById.get(membership.id) ?? 'inactive',
      })),
      sessions,
      attendance: attendanceRows.map(mapClubClinicAttendanceRow),
      messages: ((messageResult.data ?? []) as Record<string, unknown>[]).map(mapClubClinicMessageRow),
    },
  })
}

export async function POST(request: Request, context: { params: Promise<{ clubId: string; groupId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId, groupId } = await context.params
  const body = await readBody(request)
  if (!body) return Response.json({ ok: false, message: 'Check the clinic details.' }, { status: 400 })
  const access = await getClinicAccess(auth, clubId, groupId)
  if (!access.ok) return access.response

  if (body.action === 'create_sessions') {
    if (!access.coach) return Response.json({ ok: false, message: 'Clinic coach access is required.' }, { status: 403 })
    const rows = buildClinicSessionRows({
      startsAt: cleanClubText(body.startsAt, 80),
      durationMinutes: normalizeClinicDuration(body.durationMinutes),
      weeks: Number(body.weeks),
      title: cleanClubText(body.title, 120) || access.group.name,
      locationLabel: cleanClubText(body.locationLabel) || access.group.locationLabel,
      courtLabel: cleanClubText(body.courtLabel, 120),
    })
    if (!rows.length) return Response.json({ ok: false, message: 'Choose the first clinic date and time.' }, { status: 400 })
    const result = await auth.supabase.from('club_clinic_sessions').insert(rows.map((row) => ({
      ...row,
      group_id: groupId,
      created_by_user_id: auth.userId,
      updated_by_user_id: auth.userId,
    }))).select(sessionSelect)
    if (result.error) return clinicDatabaseError(result.error.message)
    return Response.json({ ok: true, sessions: ((result.data ?? []) as Record<string, unknown>[]).map(mapClubClinicSessionRow) })
  }

  if (body.action === 'message') {
    if (!access.canPost) return Response.json({ ok: false, message: 'Join this clinic before posting an update.' }, { status: 403 })
    const bodyText = cleanClubMultiline(body.body, 2000)
    if (!bodyText) return Response.json({ ok: false, message: 'Write an update first.' }, { status: 400 })
    const kind = access.coach ? normalizeClinicMessageKind(body.kind) : 'update'
    const result = await auth.supabase.from('club_group_messages').insert({
      group_id: groupId,
      author_user_id: auth.userId,
      author_name: access.membership.displayName || access.membership.email || 'Club member',
      body: bodyText,
      kind,
    }).select('id,group_id,author_name,body,kind,created_at').single()
    if (result.error) return clinicDatabaseError(result.error.message)
    return Response.json({ ok: true, message: mapClubClinicMessageRow(result.data as Record<string, unknown>) })
  }

  return Response.json({ ok: false, message: 'Choose a clinic action.' }, { status: 400 })
}

export async function PATCH(request: Request, context: { params: Promise<{ clubId: string; groupId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId, groupId } = await context.params
  const body = await readBody(request)
  if (!body) return Response.json({ ok: false, message: 'Check the clinic details.' }, { status: 400 })
  const access = await getClinicAccess(auth, clubId, groupId)
  if (!access.ok) return access.response

  if (body.action === 'setup') {
    if (!access.manager) return Response.json({ ok: false, message: 'Clinic manager access is required.' }, { status: 403 })
    const result = await auth.supabase.from('club_groups').update({
      name: cleanClubText(body.name, 120) || access.group.name,
      description: cleanClubMultiline(body.description),
      season_label: cleanClubText(body.seasonLabel),
      lead_user_id: cleanClubText(body.leadUserId) || null,
      capacity: normalizeClinicCapacity(body.capacity),
      location_label: cleanClubText(body.locationLabel),
      registration_url: normalizeClinicExternalUrl(body.registrationUrl),
      default_duration_minutes: normalizeClinicDuration(body.defaultDurationMinutes),
      is_public: body.isPublic !== false,
    }).eq('id', groupId).eq('club_id', clubId).select(groupSelect).single()
    if (result.error) return clinicDatabaseError(result.error.message)
    return Response.json({ ok: true, clinic: mapClubClinicRow(result.data as Record<string, unknown>) })
  }

  if (body.action === 'roster') {
    if (!access.manager) return Response.json({ ok: false, message: 'Clinic manager access is required.' }, { status: 403 })
    const roster = Array.isArray(body.roster) ? body.roster : []
    const normalized = roster
      .map((item) => item && typeof item === 'object' ? item as Record<string, unknown> : {})
      .map((item) => ({ membership_id: cleanClubText(item.membershipId), status: normalizeClinicRosterStatus(item.status) }))
      .filter((item) => item.membership_id && item.status !== 'inactive')
    if (normalized.length) {
      const upsertResult = await auth.supabase.from('club_group_members').upsert(
        normalized.map((item) => ({ group_id: groupId, ...item })),
        { onConflict: 'group_id,membership_id' },
      )
      if (upsertResult.error) return clinicDatabaseError(upsertResult.error.message)
    }
    const keptMembershipIds = new Set(normalized.map((item) => item.membership_id))
    const removedMembershipIds = access.rosterMembershipIds.filter((membershipId) => !keptMembershipIds.has(membershipId))
    if (removedMembershipIds.length) {
      const deleteResult = await auth.supabase.from('club_group_members').delete().eq('group_id', groupId).in('membership_id', removedMembershipIds)
      if (deleteResult.error) return clinicDatabaseError(deleteResult.error.message)
    }
    return Response.json({ ok: true })
  }

  if (body.action === 'session') {
    if (!access.coach) return Response.json({ ok: false, message: 'Clinic coach access is required.' }, { status: 403 })
    const sessionId = cleanClubText(body.sessionId)
    const result = await auth.supabase.from('club_clinic_sessions').update({
      focus: cleanClubText(body.focus, 320),
      plan: cleanClubMultiline(body.plan, 4000),
      player_next_step: cleanClubMultiline(body.playerNextStep, 1600),
      status: body.status === 'completed' || body.status === 'canceled' ? body.status : 'scheduled',
      updated_by_user_id: auth.userId,
    }).eq('id', sessionId).eq('group_id', groupId).select(sessionSelect).single()
    if (result.error) return clinicDatabaseError(result.error.message)
    return Response.json({ ok: true, session: mapClubClinicSessionRow(result.data as Record<string, unknown>) })
  }

  if (body.action === 'attendance') {
    if (!access.coach) return Response.json({ ok: false, message: 'Clinic coach access is required.' }, { status: 403 })
    const sessionId = cleanClubText(body.sessionId)
    const attendance = Array.isArray(body.attendance) ? body.attendance : []
    const rows = attendance
      .map((item) => item && typeof item === 'object' ? item as Record<string, unknown> : {})
      .map((item) => ({
        session_id: sessionId,
        membership_id: cleanClubText(item.membershipId),
        status: normalizeClinicAttendanceStatus(item.status),
        note: cleanClubText(item.note, 500),
        updated_by_user_id: auth.userId,
      }))
      .filter((item) => item.membership_id)
    if (rows.length) {
      const result = await auth.supabase.from('club_clinic_attendance').upsert(rows, { onConflict: 'session_id,membership_id' })
      if (result.error) return clinicDatabaseError(result.error.message)
    }
    return Response.json({ ok: true })
  }

  return Response.json({ ok: false, message: 'Choose a clinic action.' }, { status: 400 })
}

async function getClinicAccess(auth: Extract<Awaited<ReturnType<typeof getClubApiAuth>>, { ok: true }>, clubId: string, groupId: string) {
  const [membershipResult, groupResult, rosterResult] = await Promise.all([
    auth.supabase.from('club_memberships').select(membershipSelect).eq('club_id', clubId).eq('user_id', auth.userId).eq('status', 'active').maybeSingle(),
    auth.supabase.from('club_groups').select(groupSelect).eq('id', groupId).eq('club_id', clubId).eq('group_type', 'clinic').eq('is_active', true).maybeSingle(),
    auth.supabase.from('club_group_members').select('membership_id,status').eq('group_id', groupId),
  ])
  if (membershipResult.error || groupResult.error || rosterResult.error) return { ok: false as const, response: clinicDatabaseError(membershipResult.error?.message || groupResult.error?.message || rosterResult.error?.message || '') }
  if (!membershipResult.data || !groupResult.data) return { ok: false as const, response: Response.json({ ok: false, message: 'Clinic not found.' }, { status: 404 }) }
  const membership = mapClubMembershipRow(membershipResult.data as Record<string, unknown>)
  const group = mapClubClinicRow(groupResult.data as Record<string, unknown>)
  const manager = canManageClinic(membership.roles, group.leadUserId, auth.userId)
  const coach = manager || canCoachClinic(membership.roles) && group.leadUserId === auth.userId
  const rosterRows = (rosterResult.data ?? []) as Record<string, unknown>[]
  const rostered = rosterRows.some((row) => cleanClubText(row.membership_id) === membership.id && row.status !== 'inactive')
  return {
    ok: true as const,
    membership,
    group,
    manager,
    coach,
    canPost: manager || rostered,
    rosterMembershipIds: rosterRows.map((row) => cleanClubText(row.membership_id)).filter(Boolean),
  }
}

async function readBody(request: Request) {
  try {
    return await request.json() as Record<string, unknown>
  } catch {
    return null
  }
}

function clinicDatabaseError(message: string) {
  const missingSchema = message.toLowerCase().includes('club_clinic_') || message.toLowerCase().includes('club_group_messages') || message.toLowerCase().includes('default_duration_minutes')
  return Response.json({
    ok: false,
    message: missingSchema
      ? 'Clinic Hub is ready in the app, but its database update has not been applied yet.'
      : 'Clinic Hub could not complete that action. Try again.',
  }, { status: 500 })
}
