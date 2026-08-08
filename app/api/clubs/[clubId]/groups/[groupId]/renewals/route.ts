import { getClubApiAuth } from '@/lib/club-api-auth'
import { cleanClubText, isClubManager, normalizeClubRoles } from '@/lib/club-workspace'

export const runtime = 'nodejs'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request, context: { params: Promise<{ clubId: string; groupId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId, groupId } = await context.params
  if (!uuidPattern.test(clubId) || !uuidPattern.test(groupId)) {
    return Response.json({ ok: false, message: 'Choose a valid Club program.' }, { status: 400 })
  }

  const [managerResult, groupResult] = await Promise.all([
    auth.supabase
      .from('club_memberships')
      .select('roles')
      .eq('club_id', clubId)
      .eq('user_id', auth.userId)
      .eq('status', 'active')
      .maybeSingle(),
    auth.supabase
      .from('club_groups')
      .select('id,name,season_label,is_active')
      .eq('id', groupId)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .maybeSingle(),
  ])
  if (!managerResult.data || !isClubManager(normalizeClubRoles(managerResult.data.roles, []))) {
    return Response.json({ ok: false, message: 'Club manager access is required to request player decisions.' }, { status: 403 })
  }
  if (!groupResult.data) return Response.json({ ok: false, message: 'That active Club program was not found.' }, { status: 404 })

  const [reviewResult, existingResult] = await Promise.all([
    auth.supabase
      .from('club_group_members')
      .select('membership_id')
      .eq('group_id', groupId)
      .eq('status', 'waitlist'),
    auth.supabase
      .from('club_group_renewals')
      .select('membership_id')
      .eq('group_id', groupId),
  ])
  if (reviewResult.error || existingResult.error) {
    return Response.json({ ok: false, message: 'Returning players could not be opened.' }, { status: 400 })
  }

  const existingMembershipIds = new Set((existingResult.data ?? []).map((row) => cleanClubText(row.membership_id)))
  const reviewMembershipIds = Array.from(new Set((reviewResult.data ?? []).map((row) => cleanClubText(row.membership_id)).filter(Boolean))).slice(0, 200)
  const missingMembershipIds = reviewMembershipIds.filter((membershipId) => !existingMembershipIds.has(membershipId))
  if (!reviewMembershipIds.length && !existingMembershipIds.size) {
    return Response.json({ ok: false, message: 'No returning players are waiting for a decision in this program.' }, { status: 409 })
  }

  if (missingMembershipIds.length) {
    const { error } = await auth.supabase.from('club_group_renewals').insert(missingMembershipIds.map((membershipId) => ({
      club_id: clubId,
      group_id: groupId,
      membership_id: membershipId,
      created_by_user_id: auth.userId,
    })))
    if (error) return Response.json({ ok: false, message: 'Renewal links could not be prepared.' }, { status: 400 })
  }

  const { data: renewalRows, error: renewalError } = await auth.supabase
    .from('club_group_renewals')
    .select('membership_id,response_token,status,expires_at,responded_at')
    .eq('group_id', groupId)
    .order('status')
    .order('created_at')
  if (renewalError || !renewalRows?.length) {
    return Response.json({ ok: false, message: 'Renewal links could not be opened.' }, { status: 400 })
  }

  const membershipIds = renewalRows.map((row) => cleanClubText(row.membership_id)).filter(Boolean)
  const { data: memberships, error: membershipError } = await auth.supabase
    .from('club_memberships')
    .select('id,display_name,email,phone,status')
    .eq('club_id', clubId)
    .in('id', membershipIds)
  if (membershipError) return Response.json({ ok: false, message: 'Returning player contacts could not be opened.' }, { status: 400 })
  const membershipsById = new Map((memberships ?? []).map((membership) => [cleanClubText(membership.id), membership]))

  return Response.json({
    ok: true,
    group: {
      id: cleanClubText(groupResult.data.id),
      name: cleanClubText(groupResult.data.name),
      seasonLabel: cleanClubText(groupResult.data.season_label),
    },
    renewals: renewalRows.map((renewal) => {
      const membership = membershipsById.get(cleanClubText(renewal.membership_id))
      return {
        membershipId: cleanClubText(renewal.membership_id),
        playerName: cleanClubText(membership?.display_name) || cleanClubText(membership?.email, 180) || 'Player',
        email: cleanClubText(membership?.email, 180),
        phone: cleanClubText(membership?.phone, 40),
        responseToken: cleanClubText(renewal.response_token),
        status: cleanClubText(renewal.status),
        expiresAt: cleanClubText(renewal.expires_at, 80),
        respondedAt: cleanClubText(renewal.responded_at, 80),
      }
    }),
  })
}
