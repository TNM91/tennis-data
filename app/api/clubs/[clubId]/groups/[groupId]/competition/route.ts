import { getClubApiAuth } from '@/lib/club-api-auth'
import { canRunClubPrograms, cleanClubText, normalizeClubRoles, type ClubGroupType } from '@/lib/club-workspace'

export const runtime = 'nodejs'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PATCH(request: Request, context: { params: Promise<{ clubId: string; groupId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId, groupId } = await context.params
  if (!uuidPattern.test(clubId) || !uuidPattern.test(groupId)) {
    return Response.json({ ok: false, message: 'Choose a valid Club program.' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({})) as { competitionId?: unknown }
  const competitionId = cleanClubText(body.competitionId)
  if (!competitionId) return Response.json({ ok: false, message: 'Choose the competition to connect.' }, { status: 400 })

  const [membershipResult, groupResult] = await Promise.all([
    auth.supabase
      .from('club_memberships')
      .select('roles')
      .eq('club_id', clubId)
      .eq('user_id', auth.userId)
      .eq('status', 'active')
      .maybeSingle(),
    auth.supabase
      .from('club_groups')
      .select('id,name,group_type,is_active')
      .eq('id', groupId)
      .eq('club_id', clubId)
      .maybeSingle(),
  ])
  if (!membershipResult.data || !canRunClubPrograms(normalizeClubRoles(membershipResult.data.roles, []))) {
    return Response.json({ ok: false, message: 'Club staff access is required to connect this competition.' }, { status: 403 })
  }
  const group = groupResult.data
  if (groupResult.error || !group || group.is_active === false) {
    return Response.json({ ok: false, message: 'Active Club program not found.' }, { status: 404 })
  }

  const groupType = cleanClubText(group.group_type) as ClubGroupType
  const competitionType = groupType === 'league_division' ? 'league' : groupType === 'tournament_field' ? 'tournament' : ''
  if (!competitionType) {
    return Response.json({ ok: false, message: 'Only league and tournament programs can connect to a competition.' }, { status: 400 })
  }

  const table = competitionType === 'league' ? 'tiq_leagues' : 'tiq_tournaments'
  const nameColumn = competitionType === 'league' ? 'league_name' : 'name'
  const { data: competition, error: competitionError } = await auth.supabase
    .from(table)
    .select(`id,club_group_id,${nameColumn}`)
    .eq('id', competitionId)
    .eq('club_id', clubId)
    .maybeSingle()
  if (competitionError || !competition) {
    return Response.json({ ok: false, message: `This ${competitionType} is not available in this club.` }, { status: 404 })
  }
  const competitionRow = competition as Record<string, unknown>
  const currentGroupId = cleanClubText(competitionRow.club_group_id)
  if (currentGroupId && currentGroupId !== groupId) {
    return Response.json({ ok: false, message: `This ${competitionType} is already connected to another Club program.` }, { status: 409 })
  }

  const { data: existingLink, error: existingLinkError } = await auth.supabase
    .from(table)
    .select('id')
    .eq('club_group_id', groupId)
    .neq('id', competitionId)
    .maybeSingle()
  if (existingLinkError || existingLink) {
    return Response.json({ ok: false, message: 'This Club program is already connected to another competition.' }, { status: 409 })
  }

  const { error: updateError } = await auth.supabase
    .from(table)
    .update({ club_group_id: groupId, updated_by_user_id: auth.userId })
    .eq('id', competitionId)
    .eq('club_id', clubId)
  if (updateError) {
    return Response.json({ ok: false, message: `The ${competitionType} could not be connected.` }, { status: 400 })
  }

  const competitionName = cleanClubText(competitionRow[nameColumn]) || (competitionType === 'league' ? 'League' : 'Tournament')
  return Response.json({
    ok: true,
    competitionId,
    competitionType,
    message: `${competitionName} is now connected to ${cleanClubText(group.name) || 'this Club program'}.`,
  })
}
