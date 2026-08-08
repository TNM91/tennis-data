import { getClubApiAuth } from '@/lib/club-api-auth'
import { normalizeClinicCapacity, normalizeClinicDuration, normalizeClinicExternalUrl } from '@/lib/club-clinics'
import { cleanClubMultiline, cleanClubText, isClubManager, mapClubGroupRow, normalizeClubRoles, type ClubGroupType } from '@/lib/club-workspace'

export const runtime = 'nodejs'

const allowedTypes = new Set<ClubGroupType>(['clinic', 'team', 'camp', 'development_group', 'league_division', 'tournament_field'])
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const groupSelect = 'id,club_id,name,group_type,description,season_label,lead_user_id,capacity,location_label,registration_url,default_duration_minutes,is_public,is_active,rollover_source_group_id,updated_at'

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
      capacity: normalizeClinicCapacity(body.capacity),
      location_label: cleanClubText(body.locationLabel),
      registration_url: normalizeClinicExternalUrl(body.registrationUrl),
      default_duration_minutes: normalizeClinicDuration(body.defaultDurationMinutes),
      is_public: body.isPublic !== false,
      created_by_user_id: auth.userId,
    })
    .select(groupSelect)
    .single()

  if (error) return Response.json({ ok: false, message: 'Club staff access is required to add a group.' }, { status: 403 })
  return Response.json({ ok: true, group: mapClubGroupRow(data as Record<string, unknown>) })
}

export async function PUT(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params
  if (!uuidPattern.test(clubId)) return Response.json({ ok: false, message: 'Choose a valid club.' }, { status: 400 })

  const { data: managerMembership } = await auth.supabase
    .from('club_memberships')
    .select('roles')
    .eq('club_id', clubId)
    .eq('user_id', auth.userId)
    .eq('status', 'active')
    .maybeSingle()
  if (!managerMembership || !isClubManager(normalizeClubRoles(managerMembership.roles, []))) {
    return Response.json({ ok: false, message: 'Club manager access is required to start a new season.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { sourceGroupIds?: unknown; seasonLabel?: unknown; copyMembers?: unknown }
  const sourceGroupIds = Array.from(new Set(
    (Array.isArray(body.sourceGroupIds) ? body.sourceGroupIds : [])
      .map((value) => cleanClubText(value))
      .filter((value) => uuidPattern.test(value)),
  )).slice(0, 50)
  const seasonLabel = cleanClubText(body.seasonLabel, 80)
  const copyMembers = body.copyMembers !== false
  if (!sourceGroupIds.length) return Response.json({ ok: false, message: 'Choose at least one program to carry forward.' }, { status: 400 })
  if (seasonLabel.length < 2) return Response.json({ ok: false, message: 'Name the new season.' }, { status: 400 })

  const { data: sourceGroups, error: sourceError } = await auth.supabase
    .from('club_groups')
    .select('id,name,group_type,description,season_label,lead_user_id,capacity,location_label,registration_url,default_duration_minutes,is_public')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .in('id', sourceGroupIds)
  if (sourceError || (sourceGroups ?? []).length !== sourceGroupIds.length) {
    return Response.json({ ok: false, message: 'Every selected program must still be active in this club.' }, { status: 409 })
  }
  const sourceSeasons = Array.from(new Set((sourceGroups ?? []).map((group) => cleanClubText(group.season_label).toLowerCase())))
  if (sourceSeasons.length !== 1) return Response.json({ ok: false, message: 'Carry programs forward from one season at a time.' }, { status: 400 })
  if (sourceSeasons[0] === seasonLabel.toLowerCase()) return Response.json({ ok: false, message: 'Use a different name for the new season.' }, { status: 400 })

  const { data: existingRollovers, error: rolloverReadError } = await auth.supabase
    .from('club_groups')
    .select('rollover_source_group_id')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .eq('season_label', seasonLabel)
    .in('rollover_source_group_id', sourceGroupIds)
  if (rolloverReadError) return Response.json({ ok: false, message: 'The new season could not be checked.' }, { status: 400 })
  if ((existingRollovers ?? []).length) {
    return Response.json({ ok: false, message: 'One or more selected programs are already in this season.' }, { status: 409 })
  }

  const { data: createdGroups, error: createError } = await auth.supabase
    .from('club_groups')
    .insert((sourceGroups ?? []).map((group) => ({
      club_id: clubId,
      name: group.name,
      group_type: group.group_type,
      description: group.description,
      season_label: seasonLabel,
      lead_user_id: group.lead_user_id,
      capacity: group.capacity,
      location_label: group.location_label,
      registration_url: group.registration_url,
      default_duration_minutes: group.default_duration_minutes,
      is_public: group.is_public,
      rollover_source_group_id: group.id,
      created_by_user_id: auth.userId,
    })))
    .select(groupSelect)
  if (createError || !createdGroups?.length) {
    return Response.json({ ok: false, message: 'The selected programs could not be carried into the new season.' }, { status: createError?.code === '23505' ? 409 : 400 })
  }

  let reviewCount = 0
  if (copyMembers) {
    const { data: sourceMembers, error: memberReadError } = await auth.supabase
      .from('club_group_members')
      .select('group_id,membership_id')
      .in('group_id', sourceGroupIds)
      .eq('status', 'active')
    const createdBySource = new Map(createdGroups.map((group) => [cleanClubText(group.rollover_source_group_id), cleanClubText(group.id)]))
    const reviewRows = (sourceMembers ?? []).map((member) => ({
      group_id: createdBySource.get(cleanClubText(member.group_id)) ?? '',
      membership_id: cleanClubText(member.membership_id),
      status: 'waitlist',
    })).filter((member) => member.group_id && member.membership_id)
    const memberInsertError = memberReadError || !reviewRows.length
      ? null
      : (await auth.supabase.from('club_group_members').insert(reviewRows)).error
    if (memberReadError || memberInsertError) {
      await auth.supabase.from('club_groups').delete().in('id', createdGroups.map((group) => group.id))
      return Response.json({ ok: false, message: 'The programs were not created because returning players could not be prepared for review.' }, { status: 400 })
    }
    reviewCount = new Set(reviewRows.map((row) => row.membership_id)).size
  }

  return Response.json({
    ok: true,
    createdCount: createdGroups.length,
    reviewCount,
    seasonLabel,
    message: `${createdGroups.length} ${createdGroups.length === 1 ? 'program is' : 'programs are'} ready for ${seasonLabel}${reviewCount ? ` with ${reviewCount} returning ${reviewCount === 1 ? 'player' : 'players'} to review` : ''}.`,
  })
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
