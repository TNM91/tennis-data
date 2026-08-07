import { getClubApiAuth } from '@/lib/club-api-auth'
import { cleanClubText, mapClubInviteRow, normalizeClubRoles } from '@/lib/club-workspace'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, message: 'Enter an email and choose a role.' }, { status: 400 })
  }

  const email = cleanClubText(body.email, 180).toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ ok: false, message: 'Enter a valid email.' }, { status: 400 })
  const roles = normalizeClubRoles(body.roles).filter((role) => role !== 'owner')

  const { data, error } = await auth.supabase
    .from('club_invites')
    .insert({ club_id: clubId, invited_by_user_id: auth.userId, email, roles })
    .select('id,club_id,email,roles,invite_token,status,expires_at,created_at')
    .single()

  if (error) return Response.json({ ok: false, message: 'Only club managers can invite people.' }, { status: 403 })
  return Response.json({ ok: true, invite: mapClubInviteRow(data as Record<string, unknown>) })
}

export async function PATCH(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, message: 'Choose a member and role.' }, { status: 400 })
  }

  const membershipId = cleanClubText(body.membershipId)
  const { data: currentMembership } = await auth.supabase
    .from('club_memberships')
    .select('roles')
    .eq('id', membershipId)
    .eq('club_id', clubId)
    .maybeSingle()
  if (!currentMembership) return Response.json({ ok: false, message: 'Club member not found.' }, { status: 404 })
  if (normalizeClubRoles(currentMembership.roles).includes('owner')) {
    return Response.json({ ok: false, message: 'The club owner role cannot be reassigned here.' }, { status: 400 })
  }

  const requestedRoles = normalizeClubRoles(body.roles).filter((role) => role !== 'owner')
  const roles = requestedRoles.length ? requestedRoles : ['player']
  const { error } = await auth.supabase
    .from('club_memberships')
    .update({ roles })
    .eq('id', membershipId)
    .eq('club_id', clubId)

  if (error) return Response.json({ ok: false, message: 'Only club managers can update roles.' }, { status: 403 })
  return Response.json({ ok: true })
}
