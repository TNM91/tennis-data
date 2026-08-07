import { getClubApiAuth } from '@/lib/club-api-auth'
import { cleanClubMultiline, cleanClubText, mapClubGroupRow, type ClubGroupType } from '@/lib/club-workspace'

export const runtime = 'nodejs'

const allowedTypes = new Set<ClubGroupType>(['clinic', 'team', 'camp', 'development_group', 'league_division', 'tournament_field'])

export async function POST(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, message: 'Enter the group details.' }, { status: 400 })
  }

  const name = cleanClubText(body.name, 120)
  const requestedType = cleanClubText(body.groupType) as ClubGroupType
  const groupType: ClubGroupType = allowedTypes.has(requestedType) ? requestedType : 'clinic'
  if (name.length < 2) return Response.json({ ok: false, message: 'Enter the group name.' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('club_groups')
    .insert({
      club_id: clubId,
      name,
      group_type: groupType,
      description: cleanClubMultiline(body.description),
      season_label: cleanClubText(body.seasonLabel),
      lead_user_id: cleanClubText(body.leadUserId) || null,
      is_public: body.isPublic !== false,
      created_by_user_id: auth.userId,
    })
    .select('id,club_id,name,group_type,description,season_label,lead_user_id,is_public,is_active,updated_at')
    .single()

  if (error) return Response.json({ ok: false, message: 'Club staff access is required to add a group.' }, { status: 403 })
  return Response.json({ ok: true, group: mapClubGroupRow(data as Record<string, unknown>) })
}

export async function PATCH(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params

  let body: { groupId?: unknown; membershipIds?: unknown }
  try {
    body = await request.json() as { groupId?: unknown; membershipIds?: unknown }
  } catch {
    return Response.json({ ok: false, message: 'Choose a group and its members.' }, { status: 400 })
  }

  const groupId = cleanClubText(body.groupId)
  const membershipIds = Array.isArray(body.membershipIds)
    ? Array.from(new Set(body.membershipIds.map((value) => cleanClubText(value)).filter(Boolean)))
    : []

  const { data: group } = await auth.supabase.from('club_groups').select('id').eq('id', groupId).eq('club_id', clubId).maybeSingle()
  if (!group) return Response.json({ ok: false, message: 'Group not found.' }, { status: 404 })

  const deleteResult = await auth.supabase.from('club_group_members').delete().eq('group_id', groupId)
  if (deleteResult.error) return Response.json({ ok: false, message: 'Club staff access is required to update this group.' }, { status: 403 })

  if (membershipIds.length) {
    const insertResult = await auth.supabase.from('club_group_members').insert(
      membershipIds.map((membershipId) => ({ group_id: groupId, membership_id: membershipId, status: 'active' })),
    )
    if (insertResult.error) return Response.json({ ok: false, message: 'Some group members could not be added.' }, { status: 400 })
  }

  return Response.json({ ok: true })
}
