import { getCoachApiAuth } from '@/lib/coach-api-auth'
import { buildCoachStudentLinkPayload } from '@/lib/coach-storage'
import { cleanClubText, canRunClubPrograms, normalizeClubRoles } from '@/lib/club-workspace'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params

  let body: { groupId?: unknown } = {}
  try {
    body = await request.json() as { groupId?: unknown }
  } catch {
    // Syncing the full player roster does not require a body.
  }

  const { data: currentMembership } = await auth.supabase
    .from('club_memberships')
    .select('roles')
    .eq('club_id', clubId)
    .eq('user_id', auth.userId)
    .eq('status', 'active')
    .maybeSingle()
  if (!currentMembership || !canRunClubPrograms(normalizeClubRoles(currentMembership.roles))) {
    return Response.json({ ok: false, message: 'Club coach access is required to connect this roster.' }, { status: 403 })
  }

  const { data: club } = await auth.supabase.from('clubs').select('name').eq('id', clubId).maybeSingle()
  const { data: members, error: memberError } = await auth.supabase
    .from('club_memberships')
    .select('id,user_id,roles,display_name,email,phone')
    .eq('club_id', clubId)
    .eq('status', 'active')
  if (memberError) return Response.json({ ok: false, message: 'The club roster could not load.' }, { status: 500 })

  let allowedMembershipIds: Set<string> | null = null
  const groupId = cleanClubText(body.groupId)
  if (groupId) {
    const { data: group } = await auth.supabase
      .from('club_groups')
      .select('id')
      .eq('id', groupId)
      .eq('club_id', clubId)
      .maybeSingle()
    if (!group) return Response.json({ ok: false, message: 'Club program not found.' }, { status: 404 })

    const { data: groupMembers, error } = await auth.supabase
      .from('club_group_members')
      .select('membership_id')
      .eq('group_id', groupId)
      .eq('status', 'active')
    if (error) return Response.json({ ok: false, message: 'The program roster could not load.' }, { status: 500 })
    allowedMembershipIds = new Set((groupMembers ?? []).map((row) => cleanClubText(row.membership_id)))
  }

  const payloads = ((members ?? []) as Array<Record<string, unknown>>)
    .filter((member) => normalizeClubRoles(member.roles).includes('player'))
    .filter((member) => !allowedMembershipIds || allowedMembershipIds.has(cleanClubText(member.id)))
    .filter((member) => cleanClubText(member.user_id) !== auth.userId)
    .map((member) => buildCoachStudentLinkPayload({
      id: `club-${clubId}-${cleanClubText(member.id)}`,
      playerUserId: cleanClubText(member.user_id),
      playerName: cleanClubText(member.display_name) || cleanClubText(member.email) || 'Club player',
      playerEmail: cleanClubText(member.email),
      playerPhone: cleanClubText(member.phone),
      contactPreference: cleanClubText(member.phone) ? 'both' : 'in_app',
      setupStatus: cleanClubText(member.user_id) ? 'linked' : 'manual',
      status: 'needs_assignment',
      notes: `Connected from ${cleanClubText(club?.name) || 'Club Workspace'}.`,
    }, auth.userId))
    .filter((payload): payload is NonNullable<typeof payload> => Boolean(payload))

  if (!payloads.length) return Response.json({ ok: true, synced: 0 })
  const { error } = await auth.supabase.from('coach_player_links').upsert(payloads, { onConflict: 'id' })
  if (error) return Response.json({ ok: false, message: 'The roster could not be connected to Coach Hub.' }, { status: 500 })
  return Response.json({ ok: true, synced: payloads.length })
}
