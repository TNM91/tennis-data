import { getClubApiAuth } from '@/lib/club-api-auth'
import { canRunClubPrograms, cleanClubText, normalizeClubRoles, type ClubGroupType } from '@/lib/club-workspace'

export const runtime = 'nodejs'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeEntryName(value: unknown) {
  return cleanClubText(value, 120).toLowerCase().replace(/\s+/g, ' ')
}

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

export async function PUT(request: Request, context: { params: Promise<{ clubId: string; groupId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId, groupId } = await context.params
  if (!uuidPattern.test(clubId) || !uuidPattern.test(groupId)) {
    return Response.json({ ok: false, message: 'Choose a valid Club competition program.' }, { status: 400 })
  }
  const body = await request.json().catch(() => ({})) as { teamGroupIds?: unknown }
  const teamGroupIds = Array.from(new Set((Array.isArray(body.teamGroupIds) ? body.teamGroupIds : [])
    .map((value) => cleanClubText(value))
    .filter((value) => uuidPattern.test(value)))).slice(0, 50)
  if (!teamGroupIds.length) return Response.json({ ok: false, message: 'Choose at least one Club team.' }, { status: 400 })

  const [membershipResult, programResult, teamGroupResult] = await Promise.all([
    auth.supabase.from('club_memberships').select('roles').eq('club_id', clubId).eq('user_id', auth.userId).eq('status', 'active').maybeSingle(),
    auth.supabase.from('club_groups').select('id,name,group_type,is_active').eq('id', groupId).eq('club_id', clubId).maybeSingle(),
    auth.supabase.from('club_groups').select('id,name').eq('club_id', clubId).eq('group_type', 'team').eq('is_active', true).in('id', teamGroupIds),
  ])
  if (!membershipResult.data || !canRunClubPrograms(normalizeClubRoles(membershipResult.data.roles, []))) {
    return Response.json({ ok: false, message: 'Club staff access is required to add teams.' }, { status: 403 })
  }
  const program = programResult.data
  if (!program || program.is_active === false || teamGroupResult.error || (teamGroupResult.data ?? []).length !== teamGroupIds.length) {
    return Response.json({ ok: false, message: 'Every selected team must be active in this club.' }, { status: 409 })
  }
  const competitionType = program.group_type === 'league_division' ? 'league' : program.group_type === 'tournament_field' ? 'tournament' : ''
  if (!competitionType) return Response.json({ ok: false, message: 'Choose a league or tournament program.' }, { status: 400 })

  const teamGroups = Array.from(new Map((teamGroupResult.data ?? [])
    .map((team) => ({ id: cleanClubText(team.id), name: cleanClubText(team.name, 120) }))
    .filter((team) => team.id && team.name)
    .map((team) => [normalizeEntryName(team.name), team])).values())
  if (competitionType === 'league') {
    const { data: league } = await auth.supabase.from('tiq_leagues').select('id,league_name,league_format').eq('club_id', clubId).eq('club_group_id', groupId).maybeSingle()
    if (!league) return Response.json({ ok: false, message: 'The linked Club league was not found.' }, { status: 404 })
    if (league.league_format !== 'team') return Response.json({ ok: false, message: 'This league accepts players, not teams.' }, { status: 400 })
    const { data: existingEntries, error: existingError } = await auth.supabase.from('tiq_team_league_entries').select('id,team_name,team_entity_id,entry_status').eq('league_id', league.id)
    if (existingError) return Response.json({ ok: false, message: 'League teams could not be checked.' }, { status: 400 })
    const matchedTeams = teamGroups.map((team) => ({
      team,
      existing: (existingEntries ?? []).find((entry) => cleanClubText(entry.team_entity_id) === team.id)
        ?? (existingEntries ?? []).find((entry) => normalizeEntryName(entry.team_name) === normalizeEntryName(team.name)),
    }))
    const updateResults = await Promise.all(matchedTeams.filter((item) => item.existing).map((item) => auth.supabase.from('tiq_team_league_entries').update({ team_entity_id: item.team.id, entry_status: 'active', updated_by_user_id: auth.userId }).eq('id', item.existing!.id)))
    if (updateResults.some((result) => result.error)) return Response.json({ ok: false, message: 'Existing league teams could not be activated.' }, { status: 400 })
    const missingTeams = matchedTeams.filter((item) => !item.existing).map((item) => item.team)
    if (missingTeams.length) {
      const { error } = await auth.supabase.from('tiq_team_league_entries').insert(missingTeams.map((team) => ({ league_id: league.id, team_name: team.name, team_entity_id: team.id, entry_status: 'active', created_by_user_id: auth.userId, updated_by_user_id: auth.userId })))
      if (error) return Response.json({ ok: false, message: 'Club teams could not be added to this league.' }, { status: 400 })
    }
    return Response.json({ ok: true, addedCount: teamGroups.length, message: `${teamGroups.length} Club ${teamGroups.length === 1 ? 'team is' : 'teams are'} now in ${cleanClubText(league.league_name)}.` })
  }

  const { data: tournament } = await auth.supabase.from('tiq_tournaments').select('id,name,entrant_type,entrants').eq('club_id', clubId).eq('club_group_id', groupId).maybeSingle()
  if (!tournament) return Response.json({ ok: false, message: 'The linked Club tournament was not found.' }, { status: 404 })
  if (tournament.entrant_type !== 'teams') return Response.json({ ok: false, message: 'This tournament accepts players, not teams.' }, { status: 400 })
  const entrants = Array.isArray(tournament.entrants) ? tournament.entrants.map((entry) => cleanClubText(entry, 120)).filter(Boolean) : []
  const existingNames = new Set(entrants.map(normalizeEntryName))
  const nextEntrants = [...entrants]
  for (const team of teamGroups) {
    const normalizedName = normalizeEntryName(team.name)
    if (existingNames.has(normalizedName)) continue
    nextEntrants.push(team.name)
    existingNames.add(normalizedName)
  }
  const { error: updateError } = await auth.supabase.from('tiq_tournaments').update({ entrants: nextEntrants, updated_by_user_id: auth.userId }).eq('id', tournament.id).eq('club_id', clubId)
  if (updateError) return Response.json({ ok: false, message: 'Club teams could not be added to this tournament.' }, { status: 400 })
  return Response.json({ ok: true, addedCount: teamGroups.length, message: `${teamGroups.length} Club ${teamGroups.length === 1 ? 'team is' : 'teams are'} now in ${cleanClubText(tournament.name)}.` })
}
