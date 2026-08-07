import type { SupabaseClient } from '@supabase/supabase-js'
import { getClubApiAuth } from '@/lib/club-api-auth'
import { cleanClubText, mapClubInviteRow, normalizeClubRoles, type ClubGroupType, type ClubInviteTargetType } from '@/lib/club-workspace'

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
  const targetType = normalizeInviteTargetType(body.targetType)
  const targetId = targetType === 'club' ? '' : cleanClubText(body.targetId, 180)
  if (targetType !== 'club' && !targetId) return Response.json({ ok: false, message: 'Choose where this invitation should open.' }, { status: 400 })

  const target = await resolveInviteTarget(auth.supabase, clubId, targetType, targetId)
  if (!target) return Response.json({ ok: false, message: 'That program or competition is no longer available.' }, { status: 404 })

  const { data, error } = await auth.supabase
    .from('club_invites')
    .insert({
      club_id: clubId,
      invited_by_user_id: auth.userId,
      email,
      roles,
      target_type: target.type,
      target_id: target.id || null,
      target_name: target.name,
      target_group_type: target.groupType || null,
    })
    .select('id,club_id,email,roles,target_type,target_id,target_name,target_group_type,invite_token,status,expires_at,created_at')
    .single()

  if (error) return Response.json({ ok: false, message: 'Only club managers can invite people.' }, { status: 403 })
  return Response.json({ ok: true, invite: mapClubInviteRow(data as Record<string, unknown>) })
}

export async function DELETE(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params
  const inviteId = cleanClubText(new URL(request.url).searchParams.get('inviteId'))
  if (!inviteId) return Response.json({ ok: false, message: 'Choose an invitation to revoke.' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('club_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('club_id', clubId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) return Response.json({ ok: false, message: 'Only club managers can revoke invitations.' }, { status: 403 })
  if (!data) return Response.json({ ok: false, message: 'That invitation is no longer pending.' }, { status: 404 })
  return Response.json({ ok: true })
}

function normalizeInviteTargetType(value: unknown): ClubInviteTargetType {
  const targetType = cleanClubText(value)
  return targetType === 'group' || targetType === 'league' || targetType === 'tournament' ? targetType : 'club'
}

async function resolveInviteTarget(
  supabase: SupabaseClient,
  clubId: string,
  type: ClubInviteTargetType,
  id: string,
) {
  if (type === 'club') return { type, id: '', name: '', groupType: undefined }
  if (type === 'group') {
    const { data } = await supabase.from('club_groups').select('id,name,group_type').eq('club_id', clubId).eq('id', id).eq('is_active', true).maybeSingle()
    return data ? { type, id: cleanClubText(data.id), name: cleanClubText(data.name), groupType: cleanClubText(data.group_type) as ClubGroupType } : null
  }
  if (type === 'league') {
    const { data } = await supabase.from('tiq_leagues').select('id,league_name').eq('club_id', clubId).eq('id', id).maybeSingle()
    return data ? { type, id: cleanClubText(data.id), name: cleanClubText(data.league_name), groupType: undefined } : null
  }
  const { data } = await supabase.from('tiq_tournaments').select('id,name').eq('club_id', clubId).eq('id', id).maybeSingle()
  return data ? { type, id: cleanClubText(data.id), name: cleanClubText(data.name), groupType: undefined } : null
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
