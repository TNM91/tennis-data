import { getClubApiAuth } from '@/lib/club-api-auth'
import { normalizeClinicCapacity, normalizeClinicDuration, normalizeClinicExternalUrl } from '@/lib/club-clinics'
import { cleanClubMultiline, cleanClubText, isClubManager, mapClubGroupRow, normalizeClubRoles, type ClubGroupType } from '@/lib/club-workspace'

export const runtime = 'nodejs'

const allowedTypes = new Set<ClubGroupType>(['clinic', 'team', 'camp', 'development_group', 'league_division', 'tournament_field'])
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const groupSelect = 'id,club_id,name,group_type,description,season_label,lead_user_id,capacity,location_label,registration_url,default_duration_minutes,is_public,is_active,closed_at,rollover_source_group_id,launch_handoff_completed_at,updated_at'
const leagueRolloverSelect = 'id,club_group_id,league_format,individual_competition_format,team_match_format_id,scoring_system,third_set_rule,league_name,max_weeks,max_match_events,is_public,scheduling_mode,default_match_day,default_match_time,schedule_time_zone,default_facility,scheduling_notes,flight,location_label,photo_url,notes'
const tournamentRolloverSelect = 'id,club_group_id,name,format,entrant_type,location_label,director_notes,is_public'

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

  const body = await request.json().catch(() => ({})) as { sourceGroupIds?: unknown; seasonLabel?: unknown; copyMembers?: unknown; copyCompetitionSetup?: unknown }
  const sourceGroupIds = Array.from(new Set(
    (Array.isArray(body.sourceGroupIds) ? body.sourceGroupIds : [])
      .map((value) => cleanClubText(value))
      .filter((value) => uuidPattern.test(value)),
  )).slice(0, 50)
  const seasonLabel = cleanClubText(body.seasonLabel, 80)
  const copyMembers = body.copyMembers !== false
  const copyCompetitionSetup = body.copyCompetitionSetup !== false
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

  const leagueSourceGroupIds = (sourceGroups ?? []).filter((group) => group.group_type === 'league_division').map((group) => cleanClubText(group.id))
  const tournamentSourceGroupIds = (sourceGroups ?? []).filter((group) => group.group_type === 'tournament_field').map((group) => cleanClubText(group.id))
  const [sourceLeagueResult, sourceTournamentResult] = await Promise.all([
    copyCompetitionSetup && leagueSourceGroupIds.length
      ? auth.supabase.from('tiq_leagues').select(leagueRolloverSelect).eq('club_id', clubId).in('club_group_id', leagueSourceGroupIds)
      : Promise.resolve({ data: [], error: null }),
    copyCompetitionSetup && tournamentSourceGroupIds.length
      ? auth.supabase.from('tiq_tournaments').select(tournamentRolloverSelect).eq('club_id', clubId).in('club_group_id', tournamentSourceGroupIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (sourceLeagueResult.error || sourceTournamentResult.error) {
    return Response.json({ ok: false, message: 'The linked competition setup could not be read.' }, { status: 400 })
  }

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

  const createdGroupIds = createdGroups.map((group) => cleanClubText(group.id)).filter(Boolean)
  const createdBySource = new Map(createdGroups.map((group) => [cleanClubText(group.rollover_source_group_id), cleanClubText(group.id)]))
  let reviewCount = 0
  if (copyMembers) {
    const { data: sourceMembers, error: memberReadError } = await auth.supabase
      .from('club_group_members')
      .select('group_id,membership_id')
      .in('group_id', sourceGroupIds)
      .eq('status', 'active')
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

  const rollbackRollover = async () => {
    await Promise.all([
      auth.supabase.from('tiq_leagues').delete().in('club_group_id', createdGroupIds),
      auth.supabase.from('tiq_tournaments').delete().in('club_group_id', createdGroupIds),
    ])
    await auth.supabase.from('club_groups').delete().in('id', createdGroupIds)
  }

  let competitionCount = 0
  if (copyCompetitionSetup) {
    const leagueRows = ((sourceLeagueResult.data ?? []) as Record<string, unknown>[]).flatMap((league) => {
      const nextGroupId = createdBySource.get(cleanClubText(league.club_group_id))
      if (!nextGroupId) return []
      return [{
        id: `tiq-league-${nextGroupId}`,
        club_id: clubId,
        club_group_id: nextGroupId,
        competition_layer: 'tiq',
        league_format: league.league_format,
        individual_competition_format: league.individual_competition_format,
        team_match_format_id: league.team_match_format_id,
        scoring_system: league.scoring_system,
        third_set_rule: league.third_set_rule,
        league_name: league.league_name,
        season_label: seasonLabel,
        season_status: 'draft',
        starts_on: null,
        ends_on: null,
        max_weeks: league.max_weeks,
        max_match_events: league.max_match_events,
        is_public: league.is_public,
        scheduling_mode: league.scheduling_mode,
        default_match_day: league.default_match_day,
        default_match_time: league.default_match_time,
        schedule_time_zone: league.schedule_time_zone,
        default_facility: league.default_facility,
        scheduling_notes: league.scheduling_notes,
        flight: league.flight,
        location_label: league.location_label,
        photo_url: league.photo_url,
        captain_team_name: '',
        notes: league.notes,
        teams: [],
        players: [],
        created_by_user_id: auth.userId,
        updated_by_user_id: auth.userId,
      }]
    })
    const tournamentRows = ((sourceTournamentResult.data ?? []) as Record<string, unknown>[]).flatMap((tournament) => {
      const nextGroupId = createdBySource.get(cleanClubText(tournament.club_group_id))
      if (!nextGroupId) return []
      return [{
        id: `tiq-tournament-${nextGroupId}`,
        club_id: clubId,
        club_group_id: nextGroupId,
        name: tournament.name,
        format: tournament.format,
        entrant_type: tournament.entrant_type,
        status: 'draft',
        starts_on: '',
        location_label: tournament.location_label,
        director_notes: tournament.director_notes,
        entrants: [],
        results: {},
        schedule: {},
        contacts: {},
        entrant_player_ids: {},
        is_public: tournament.is_public,
        created_by_user_id: auth.userId,
        updated_by_user_id: auth.userId,
      }]
    })

    if (leagueRows.length) {
      const { error } = await auth.supabase.from('tiq_leagues').insert(leagueRows)
      if (error) {
        await rollbackRollover()
        return Response.json({ ok: false, message: 'The new season was not created because its league setup could not be prepared.' }, { status: 400 })
      }
      competitionCount += leagueRows.length
    }
    if (tournamentRows.length) {
      const { error } = await auth.supabase.from('tiq_tournaments').insert(tournamentRows)
      if (error) {
        await rollbackRollover()
        return Response.json({ ok: false, message: 'The new season was not created because its tournament setup could not be prepared.' }, { status: 400 })
      }
      competitionCount += tournamentRows.length
    }
  }

  return Response.json({
    ok: true,
    createdCount: createdGroups.length,
    reviewCount,
    competitionCount,
    seasonLabel,
    message: `${createdGroups.length} ${createdGroups.length === 1 ? 'program is' : 'programs are'} ready for ${seasonLabel}${reviewCount ? ` with ${reviewCount} returning ${reviewCount === 1 ? 'player' : 'players'} to review` : ''}.${competitionCount ? ` ${competitionCount} fresh competition ${competitionCount === 1 ? 'draft is' : 'drafts are'} connected without old entries, schedules, or results.` : ''}`,
  })
}

export async function PATCH(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params

  let body: { action?: unknown; seasonLabel?: unknown; groupId?: unknown; membershipIds?: unknown }
  try {
    body = await request.json() as { action?: unknown; seasonLabel?: unknown; groupId?: unknown; membershipIds?: unknown }
  } catch {
    return Response.json({ ok: false, message: 'Choose a group and its members.' }, { status: 400 })
  }

  const action = cleanClubText(body.action)
  if (action === 'close-season' || action === 'reopen-season') {
    const seasonLabel = cleanClubText(body.seasonLabel, 80)
    if (seasonLabel.length < 2) return Response.json({ ok: false, message: 'Choose a named season.' }, { status: 400 })

    const { data: managerMembership } = await auth.supabase
      .from('club_memberships')
      .select('roles')
      .eq('club_id', clubId)
      .eq('user_id', auth.userId)
      .eq('status', 'active')
      .maybeSingle()
    if (!managerMembership || !isClubManager(normalizeClubRoles(managerMembership.roles, []))) {
      return Response.json({ ok: false, message: 'Club manager access is required to close or reopen a season.' }, { status: 403 })
    }

    const closing = action === 'close-season'
    const { data: changedGroups, error } = await auth.supabase
      .from('club_groups')
      .update(closing
        ? { is_active: false, closed_at: new Date().toISOString(), closed_by_user_id: auth.userId }
        : { is_active: true, closed_at: null, closed_by_user_id: null })
      .eq('club_id', clubId)
      .eq('season_label', seasonLabel)
      .eq('is_active', closing)
      .select('id')
    if (error) return Response.json({ ok: false, message: `The season could not be ${closing ? 'closed' : 'reopened'}.` }, { status: 400 })
    if (!changedGroups?.length) return Response.json({ ok: false, message: `No ${closing ? 'active' : 'archived'} programs were found in ${seasonLabel}.` }, { status: 409 })

    return Response.json({
      ok: true,
      changedCount: changedGroups.length,
      message: closing
        ? `${seasonLabel} is closed. ${changedGroups.length} ${changedGroups.length === 1 ? 'program is' : 'programs are'} now read-only history.`
        : `${seasonLabel} is active again with ${changedGroups.length} ${changedGroups.length === 1 ? 'program' : 'programs'}.`,
    })
  }

  if (action === 'mark-launched') {
    const groupId = cleanClubText(body.groupId)
    if (!uuidPattern.test(groupId)) return Response.json({ ok: false, message: 'Choose a valid program to launch.' }, { status: 400 })
    const { data: managerMembership } = await auth.supabase
      .from('club_memberships')
      .select('roles')
      .eq('club_id', clubId)
      .eq('user_id', auth.userId)
      .eq('status', 'active')
      .maybeSingle()
    if (!managerMembership || !isClubManager(normalizeClubRoles(managerMembership.roles, []))) {
      return Response.json({ ok: false, message: 'Club manager access is required to launch this program.' }, { status: 403 })
    }
    const { data: launchedGroup, error } = await auth.supabase
      .from('club_groups')
      .update({ launch_handoff_completed_at: new Date().toISOString() })
      .eq('id', groupId)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .select('id')
      .maybeSingle()
    if (error) return Response.json({ ok: false, message: 'The program launch could not be saved.' }, { status: 400 })
    if (!launchedGroup) return Response.json({ ok: false, message: 'Active program not found.' }, { status: 404 })
    return Response.json({ ok: true, message: 'Program launch opened.' })
  }

  const groupId = cleanClubText(body.groupId)
  const membershipIds = Array.isArray(body.membershipIds)
    ? Array.from(new Set(body.membershipIds.map((value) => cleanClubText(value)).filter(Boolean)))
    : []

  const { data: group } = await auth.supabase.from('club_groups').select('id').eq('id', groupId).eq('club_id', clubId).eq('is_active', true).maybeSingle()
  if (!group) return Response.json({ ok: false, message: 'Active program not found.' }, { status: 404 })

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
