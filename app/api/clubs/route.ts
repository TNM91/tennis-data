import { getClubApiAuth } from '@/lib/club-api-auth'
import {
  buildClubCoachStudentLinkId,
  cleanClubMultiline,
  cleanClubText,
  createClubSlug,
  isClubManager,
  mapClubGroupRow,
  mapClubInviteRow,
  mapClubMembershipRow,
  mapClubRow,
  mapClubTemplateRow,
  normalizeClubColor,
  type ClubCalendarEvent,
  type ClubLinkedCompetition,
} from '@/lib/club-workspace'

export const runtime = 'nodejs'

const clubSelect = 'id,owner_user_id,name,slug,description,logo_url,hero_image_url,primary_color,location_label,contact_email,time_zone,is_public,onboarding_completed_at,created_at,updated_at'
const membershipSelect = 'id,club_id,user_id,roles,status,display_name,email,phone,joined_at,updated_at'
const groupSelect = 'id,club_id,name,group_type,description,season_label,lead_user_id,capacity,location_label,registration_url,default_duration_minutes,is_public,is_active,closed_at,rollover_source_group_id,renewals_finalized_at,renewal_target_roster_size,renewal_fill_completed_at,launch_handoff_completed_at,updated_at'
const templateSelect = 'id,club_id,name,competition_type,entrant_type,format_id,division_label,default_facility,schedule_notes,is_public,updated_at'
const inviteSelect = 'id,club_id,email,roles,target_type,target_id,target_name,target_group_type,invite_token,status,expires_at,created_at'

export async function GET(request: Request) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response

  const { data: membershipRows, error: membershipError } = await auth.supabase
    .from('club_memberships')
    .select(membershipSelect)
    .eq('user_id', auth.userId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  if (membershipError) return clubDatabaseError(membershipError.message)

  const memberships = ((membershipRows ?? []) as Record<string, unknown>[]).map(mapClubMembershipRow)
  const clubIds = memberships.map((membership) => membership.clubId).filter(Boolean)
  if (!clubIds.length) return Response.json({ ok: true, clubs: [], memberships: [] })

  const { data: clubRows, error: clubError } = await auth.supabase
    .from('clubs')
    .select(clubSelect)
    .in('id', clubIds)
    .order('updated_at', { ascending: false })

  if (clubError) return clubDatabaseError(clubError.message)

  const clubs = ((clubRows ?? []) as Record<string, unknown>[]).map(mapClubRow)
  const requestedClubId = new URL(request.url).searchParams.get('clubId')?.trim() ?? ''
  if (!requestedClubId) return Response.json({ ok: true, clubs, memberships })

  const club = clubs.find((item) => item.id === requestedClubId)
  const currentMembership = memberships.find((item) => item.clubId === requestedClubId)
  if (!club || !currentMembership) {
    return Response.json({ ok: false, message: 'This club is not linked to your profile.' }, { status: 403 })
  }

  const [memberResult, groupResult, templateResult, inviteResult, leagueResult, tournamentResult] = await Promise.all([
    auth.supabase.from('club_memberships').select(membershipSelect).eq('club_id', club.id).neq('status', 'removed').order('display_name'),
    auth.supabase.from('club_groups').select(groupSelect).eq('club_id', club.id).order('updated_at', { ascending: false }),
    auth.supabase.from('club_competition_templates').select(templateSelect).eq('club_id', club.id).order('updated_at', { ascending: false }),
    auth.supabase.from('club_invites').select(inviteSelect).eq('club_id', club.id).eq('status', 'pending').order('created_at', { ascending: false }),
    auth.supabase.from('tiq_leagues').select('id,club_group_id,league_name,league_format,season_status,location_label,teams,players,is_public').eq('club_id', club.id).order('updated_at', { ascending: false }),
    auth.supabase.from('tiq_tournaments').select('id,club_group_id,name,entrant_type,status,starts_on,location_label,entrants,results,schedule,is_public').eq('club_id', club.id).order('updated_at', { ascending: false }),
  ])

  const firstError = [memberResult.error, groupResult.error, templateResult.error, inviteResult.error, leagueResult.error, tournamentResult.error].find(Boolean)
  if (firstError) return clubDatabaseError(firstError.message)

  const workspaceMemberships = ((memberResult.data ?? []) as Record<string, unknown>[]).map(mapClubMembershipRow)
  const groups = ((groupResult.data ?? []) as Record<string, unknown>[]).map((row) => mapClubGroupRow(row))
  const clinicGroupIds = groups.filter((group) => group.groupType === 'clinic').map((group) => group.id)
  const teamGroups = groups.filter((group) => group.groupType === 'team')
  const coachGroups = groups.filter((group) => group.groupType === 'camp' || group.groupType === 'development_group')
  const normalizedTeamNames = Array.from(new Set(teamGroups.flatMap((group) => getTeamNameKeys(group.name))))
  const canReadRenewals = isClubManager(currentMembership.roles)
  const leagueIds = ((leagueResult.data ?? []) as Record<string, unknown>[]).map((row) => cleanClubText(row.id)).filter(Boolean)
  const teamLeagueIds = ((leagueResult.data ?? []) as Record<string, unknown>[])
    .filter((row) => row.league_format === 'team')
    .map((row) => cleanClubText(row.id))
    .filter(Boolean)
  const individualLeagueIds = ((leagueResult.data ?? []) as Record<string, unknown>[])
    .filter((row) => row.league_format === 'individual')
    .map((row) => cleanClubText(row.id))
    .filter(Boolean)
  const playerTournamentIds = ((tournamentResult.data ?? []) as Record<string, unknown>[])
    .filter((row) => row.entrant_type !== 'teams')
    .map((row) => cleanClubText(row.id))
    .filter(Boolean)
  const [groupMemberResult, renewalResult, leagueEntryResult, teamLeagueEntryResult, leagueScheduleResult, tournamentEntryResult, clinicSessionResult, teamRosterResult] = await Promise.all([
    groups.length
      ? auth.supabase.from('club_group_members').select('group_id,membership_id,status').in('group_id', groups.map((group) => group.id)).neq('status', 'inactive')
      : Promise.resolve({ data: [], error: null }),
    canReadRenewals && groups.length
      ? auth.supabase.from('club_group_renewals').select('group_id,status').in('group_id', groups.map((group) => group.id))
      : Promise.resolve({ data: [], error: null }),
    individualLeagueIds.length
      ? auth.supabase.from('tiq_player_league_entries').select('league_id,club_membership_id,entry_status').in('league_id', individualLeagueIds).eq('entry_status', 'active')
      : Promise.resolve({ data: [], error: null }),
    teamLeagueIds.length
      ? auth.supabase.from('tiq_team_league_entries').select('league_id,team_name,team_entity_id,entry_status').in('league_id', teamLeagueIds).eq('entry_status', 'active')
      : Promise.resolve({ data: [], error: null }),
    leagueIds.length
      ? auth.supabase.from('tiq_league_schedule_items').select('id,league_id,participant_a_name,participant_b_name,scheduled_date,scheduled_time,facility,status').in('league_id', leagueIds).neq('status', 'cancelled')
      : Promise.resolve({ data: [], error: null }),
    playerTournamentIds.length
      ? auth.supabase.from('tiq_tournament_entries').select('tournament_id,club_membership_id,status').in('tournament_id', playerTournamentIds).eq('status', 'approved')
      : Promise.resolve({ data: [], error: null }),
    clinicGroupIds.length
      ? auth.supabase.from('club_clinic_sessions').select('id,group_id,title,starts_at,ends_at,location_label,court_label,status').in('group_id', clinicGroupIds).neq('status', 'canceled')
      : Promise.resolve({ data: [], error: null }),
    normalizedTeamNames.length
      ? auth.supabase.from('team_roster_members').select('normalized_team_name,team_name,player_id').in('normalized_team_name', normalizedTeamNames).limit(5000)
      : Promise.resolve({ data: [], error: null }),
  ])
  const assignmentError = [groupMemberResult.error, renewalResult.error, leagueEntryResult.error, teamLeagueEntryResult.error, leagueScheduleResult.error, tournamentEntryResult.error, clinicSessionResult.error, teamRosterResult.error].find(Boolean)
  if (assignmentError) return clubDatabaseError(assignmentError.message)
  const groupMemberRows = (groupMemberResult.data ?? []) as Record<string, unknown>[]

  const rosterRowsByTeam = new Map<string, Record<string, unknown>[]>()
  for (const row of (teamRosterResult.data ?? []) as Record<string, unknown>[]) {
    const normalizedName = cleanClubText(row.normalized_team_name)
    if (normalizedName) rosterRowsByTeam.set(normalizedName, [...(rosterRowsByTeam.get(normalizedName) ?? []), row])
  }
  const getTeamRosterRows = (teamName: string) => getTeamNameKeys(teamName).flatMap((key) => rosterRowsByTeam.get(key) ?? [])
  const coachPlayerMembershipIds = new Set(workspaceMemberships
    .filter((membership) => membership.roles.includes('player') && membership.userId !== auth.userId)
    .map((membership) => membership.id))
  const coachExpectedLinkIdsByGroup = new Map<string, string[]>()
  for (const group of coachGroups) {
    const linkIds = groupMemberRows
      .filter((row) => row.status === 'active' && cleanClubText(row.group_id) === group.id && coachPlayerMembershipIds.has(cleanClubText(row.membership_id)))
      .map((row) => buildClubCoachStudentLinkId(club.id, cleanClubText(row.membership_id)))
    coachExpectedLinkIdsByGroup.set(group.id, Array.from(new Set(linkIds)))
  }
  const coachExpectedLinkIds = Array.from(new Set(Array.from(coachExpectedLinkIdsByGroup.values()).flat()))
  const [teamMatchResults, coachLinkResult] = await Promise.all([
    Promise.all(teamGroups.map(async (group) => {
      const rosterTeamName = cleanClubText(getTeamRosterRows(group.name)[0]?.team_name)
      const teamName = rosterTeamName || group.name
      const safeTeamName = teamName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      const result = await auth.supabase
        .from('matches')
        .select('id,match_date,match_time,facility,home_team,away_team,status,winner_side,score')
        .or(`home_team.eq."${safeTeamName}",away_team.eq."${safeTeamName}"`)
        .is('line_number', null)
        .order('match_date', { ascending: true })
        .limit(1000)
      return { groupId: group.id, result }
    })),
    coachExpectedLinkIds.length
      ? auth.supabase.from('coach_player_links').select('id').in('id', coachExpectedLinkIds).limit(5000)
      : Promise.resolve({ data: [], error: null }),
  ])
  const teamMatchError = teamMatchResults.map(({ result }) => result.error).find(Boolean)
  if (teamMatchError) return clubDatabaseError(teamMatchError.message)
  if (coachLinkResult.error) return clubDatabaseError(coachLinkResult.error.message)
  const linkedCoachLinkIds = new Set(((coachLinkResult.data ?? []) as Record<string, unknown>[]).map((row) => cleanClubText(row.id)).filter(Boolean))
  const coachAssignmentResult = linkedCoachLinkIds.size
    ? await auth.supabase
        .from('coach_assignments')
        .select('student_link_id,status,assignment_json')
        .in('student_link_id', Array.from(linkedCoachLinkIds))
        .in('status', ['assigned', 'completed'])
        .limit(5000)
    : { data: [], error: null }
  if (coachAssignmentResult.error) return clubDatabaseError(coachAssignmentResult.error.message)
  const coachAssignmentRows = (coachAssignmentResult.data ?? []) as Record<string, unknown>[]

  const memberIdsByGroup = new Map<string, string[]>()
  const reviewMemberIdsByGroup = new Map<string, string[]>()
  for (const row of groupMemberRows) {
    const groupId = cleanClubText(row.group_id)
    const membershipId = cleanClubText(row.membership_id)
    if (groupId && membershipId && row.status === 'active') memberIdsByGroup.set(groupId, [...(memberIdsByGroup.get(groupId) ?? []), membershipId])
    if (groupId && membershipId && row.status === 'waitlist') reviewMemberIdsByGroup.set(groupId, [...(reviewMemberIdsByGroup.get(groupId) ?? []), membershipId])
  }
  const renewalCountsByGroup = new Map<string, { pending: number; confirmed: number; declined: number }>()
  for (const row of (renewalResult.data ?? []) as Record<string, unknown>[]) {
    const groupId = cleanClubText(row.group_id)
    const status = cleanClubText(row.status)
    if (!groupId || !['pending', 'confirmed', 'declined'].includes(status)) continue
    const current = renewalCountsByGroup.get(groupId) ?? { pending: 0, confirmed: 0, declined: 0 }
    current[status as 'pending' | 'confirmed' | 'declined'] += 1
    renewalCountsByGroup.set(groupId, current)
  }
  const clinicScheduleByGroup = new Map<string, { count: number; nextAt: string }>()
  const now = Date.now()
  for (const row of (clinicSessionResult.data ?? []) as Record<string, unknown>[]) {
    const groupId = cleanClubText(row.group_id)
    if (!groupId) continue
    const current = clinicScheduleByGroup.get(groupId) ?? { count: 0, nextAt: '' }
    current.count += 1
    const startsAt = cleanClubText(row.starts_at, 80)
    const endsAt = cleanClubText(row.ends_at, 80)
    const startsAtTime = new Date(startsAt).getTime()
    const endsAtTime = new Date(endsAt).getTime()
    if (startsAt && Number.isFinite(startsAtTime) && Number.isFinite(endsAtTime) && endsAtTime >= now && (!current.nextAt || startsAtTime < new Date(current.nextAt).getTime())) current.nextAt = startsAt
    clinicScheduleByGroup.set(groupId, current)
  }
  const teamReadinessByGroup = new Map<string, { rosterCount: number; matchCount: number; nextAt: string }>()
  const today = getClubCalendarToday(club.timeZone)
  for (const group of teamGroups) {
    const rosterRows = getTeamRosterRows(group.name)
    const rosterCount = new Set(rosterRows.map((row) => cleanClubText(row.player_id)).filter(Boolean)).size
    const matchRows = (teamMatchResults.find((item) => item.groupId === group.id)?.result.data ?? []) as Record<string, unknown>[]
    const nextAt = matchRows.map((row) => cleanClubText(row.match_date, 80)).find((matchDate) => matchDate >= today) ?? ''
    teamReadinessByGroup.set(group.id, { rosterCount, matchCount: matchRows.length, nextAt })
  }
  const coachReadinessByGroup = new Map<string, { expectedCount: number; linkedCount: number; plannedCount: number; nextAt: string; actionPlayerLinkId: string }>()
  for (const group of coachGroups) {
    const expectedLinkIds = coachExpectedLinkIdsByGroup.get(group.id) ?? []
    const linkedLinkIds = expectedLinkIds.filter((linkId) => linkedCoachLinkIds.has(linkId))
    const assignmentRows = coachAssignmentRows.filter((row) => linkedLinkIds.includes(cleanClubText(row.student_link_id)) && coachAssignmentMatchesGroup(row.assignment_json, group.id))
    const plannedLinkIds = new Set(assignmentRows.map((row) => cleanClubText(row.student_link_id)).filter(Boolean))
    const nextAt = assignmentRows
      .filter((row) => cleanClubText(row.status) === 'assigned')
      .map((row) => getCoachLessonDateTime(row.assignment_json))
      .filter((lessonDateTime) => lessonDateTime && new Date(lessonDateTime).getTime() >= now)
      .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ?? ''
    const actionPlayerLinkId = expectedLinkIds.find((linkId) => !linkedCoachLinkIds.has(linkId))
      ?? linkedLinkIds.find((linkId) => !plannedLinkIds.has(linkId))
      ?? linkedLinkIds[0]
      ?? ''
    coachReadinessByGroup.set(group.id, {
      expectedCount: expectedLinkIds.length,
      linkedCount: linkedLinkIds.length,
      plannedCount: plannedLinkIds.size,
      nextAt,
      actionPlayerLinkId,
    })
  }

  const memberIdsByLeague = new Map<string, string[]>()
  const entryCountByLeague = new Map<string, number>()
  const teamNamesByLeague = new Map<string, string[]>()
  for (const row of (leagueEntryResult.data ?? []) as Record<string, unknown>[]) {
    const leagueId = cleanClubText(row.league_id)
    const membershipId = cleanClubText(row.club_membership_id)
    if (leagueId && membershipId) memberIdsByLeague.set(leagueId, [...(memberIdsByLeague.get(leagueId) ?? []), membershipId])
    if (leagueId) entryCountByLeague.set(leagueId, (entryCountByLeague.get(leagueId) ?? 0) + 1)
  }
  for (const row of (teamLeagueEntryResult.data ?? []) as Record<string, unknown>[]) {
    const leagueId = cleanClubText(row.league_id)
    if (leagueId) entryCountByLeague.set(leagueId, (entryCountByLeague.get(leagueId) ?? 0) + 1)
    const teamName = cleanClubText(row.team_name, 120)
    if (leagueId && teamName) teamNamesByLeague.set(leagueId, [...(teamNamesByLeague.get(leagueId) ?? []), teamName])
  }
  const scheduleByLeague = new Map<string, { count: number; nextAt: string }>()
  for (const row of (leagueScheduleResult.data ?? []) as Record<string, unknown>[]) {
    const leagueId = cleanClubText(row.league_id)
    if (!leagueId) continue
    const current = scheduleByLeague.get(leagueId) ?? { count: 0, nextAt: '' }
    current.count += 1
    const date = cleanClubText(row.scheduled_date, 20)
    const time = cleanClubText(row.scheduled_time, 20)
    const eventAt = date ? `${date}T${time || '12:00:00'}` : ''
    if (eventAt && date >= today && (!current.nextAt || eventAt < current.nextAt)) current.nextAt = eventAt
    scheduleByLeague.set(leagueId, current)
  }
  const memberIdsByTournament = new Map<string, string[]>()
  const approvedEntryCountByTournament = new Map<string, number>()
  for (const row of (tournamentEntryResult.data ?? []) as Record<string, unknown>[]) {
    const tournamentId = cleanClubText(row.tournament_id)
    const membershipId = cleanClubText(row.club_membership_id)
    if (tournamentId && membershipId) memberIdsByTournament.set(tournamentId, [...(memberIdsByTournament.get(tournamentId) ?? []), membershipId])
    if (tournamentId) approvedEntryCountByTournament.set(tournamentId, (approvedEntryCountByTournament.get(tournamentId) ?? 0) + 1)
  }

  const competitions: ClubLinkedCompetition[] = [
    ...((leagueResult.data ?? []) as Record<string, unknown>[]).map((row) => {
      const id = cleanClubText(row.id)
      const seededEntryValues = row.league_format === 'individual' ? row.players : row.teams
      const seededEntries = Array.isArray(seededEntryValues) ? seededEntryValues.length : 0
      const schedule = scheduleByLeague.get(id) ?? { count: 0, nextAt: '' }
      return {
      id: cleanClubText(row.id),
      clubGroupId: cleanClubText(row.club_group_id),
      name: cleanClubText(row.league_name),
      type: 'league' as const,
      entrantType: row.league_format === 'individual' ? 'players' as const : 'teams' as const,
      memberIds: memberIdsByLeague.get(cleanClubText(row.id)) ?? [],
      entryNames: Array.from(new Set([...(Array.isArray(seededEntryValues) ? seededEntryValues.map((value) => cleanClubText(value, 120)).filter(Boolean) : []), ...(teamNamesByLeague.get(id) ?? [])])),
      status: cleanClubText(row.season_status) || 'draft',
      isPublic: row.is_public !== false,
      href: `/league-coordinator?leagueId=${encodeURIComponent(cleanClubText(row.id))}`,
      entryCount: Math.max(seededEntries, entryCountByLeague.get(id) ?? 0),
      scheduleCount: schedule.count,
      nextEventAt: schedule.nextAt,
    }}),
    ...((tournamentResult.data ?? []) as Record<string, unknown>[]).map((row) => {
      const id = cleanClubText(row.id)
      const entrants = Array.isArray(row.entrants) ? row.entrants.length : 0
      const schedule = row.schedule && typeof row.schedule === 'object' && !Array.isArray(row.schedule)
        ? Object.values(row.schedule as Record<string, unknown>)
        : []
      const resultCount = row.results && typeof row.results === 'object' && !Array.isArray(row.results)
        ? Object.keys(row.results as Record<string, unknown>).length
        : 0
      const nextEventAt = schedule
        .map((item) => item && typeof item === 'object' ? item as Record<string, unknown> : {})
        .map((item) => {
          const date = cleanClubText(item.date, 20)
          const time = cleanClubText(item.time, 20)
          return date ? `${date}T${time || '12:00:00'}` : ''
        })
        .filter((eventAt) => eventAt && eventAt.slice(0, 10) >= today)
        .sort()[0] ?? cleanClubText(row.starts_on, 20)
      return {
      id: cleanClubText(row.id),
      clubGroupId: cleanClubText(row.club_group_id),
      name: cleanClubText(row.name),
      type: 'tournament' as const,
      entrantType: row.entrant_type === 'teams' ? 'teams' as const : 'players' as const,
      memberIds: memberIdsByTournament.get(cleanClubText(row.id)) ?? [],
      entryNames: Array.isArray(row.entrants) ? row.entrants.map((value) => cleanClubText(value, 120)).filter(Boolean) : [],
      status: cleanClubText(row.status) || 'draft',
      isPublic: row.is_public !== false,
      href: `/league-coordinator/tournaments?tournamentId=${encodeURIComponent(cleanClubText(row.id))}`,
      entryCount: Math.max(entrants, approvedEntryCountByTournament.get(id) ?? 0),
      scheduleCount: Math.max(schedule.length, resultCount),
      nextEventAt,
    }}),
  ]
  const competitionByGroupId = new Map(competitions.filter((competition) => competition.clubGroupId).map((competition) => [competition.clubGroupId, competition]))
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const leagueById = new Map(((leagueResult.data ?? []) as Record<string, unknown>[]).map((row) => [cleanClubText(row.id), row]))
  const calendarEvents: ClubCalendarEvent[] = []
  const resultLookback = getClubCalendarDateOffset(club.timeZone, -7)

  for (const row of (clinicSessionResult.data ?? []) as Record<string, unknown>[]) {
    const groupId = cleanClubText(row.group_id)
    const group = groupById.get(groupId)
    const startsAt = cleanClubText(row.starts_at, 80)
    const endsAt = cleanClubText(row.ends_at, 80)
    if (!group || !startsAt || !endsAt || new Date(endsAt).getTime() < now) continue
    calendarEvents.push({
      id: `clinic:${cleanClubText(row.id)}`,
      type: 'clinic',
      title: cleanClubText(row.title) || group.name,
      startsAt,
      endsAt,
      allDay: false,
      locationLabel: cleanClubText(row.location_label) || group.locationLabel || club.locationLabel,
      courtLabel: cleanClubText(row.court_label, 120),
      groupId,
      groupName: group.name,
      membershipIds: memberIdsByGroup.get(groupId) ?? [],
      href: `/clubs/clinics/${encodeURIComponent(groupId)}?clubId=${encodeURIComponent(club.id)}&tab=schedule`,
      needsResult: false,
    })
  }

  for (const group of teamGroups) {
    const matchRows = (teamMatchResults.find((item) => item.groupId === group.id)?.result.data ?? []) as Record<string, unknown>[]
    for (const row of matchRows) {
      const date = cleanClubText(row.match_date, 20)
      if (!date || date < resultLookback) continue
      const startsAt = buildClubCalendarDateTime(date, cleanClubText(row.match_time, 20))
      const homeTeam = cleanClubText(row.home_team, 120)
      const awayTeam = cleanClubText(row.away_team, 120)
      calendarEvents.push({
        id: `team:${group.id}:${cleanClubText(row.id) || `${date}:${homeTeam}:${awayTeam}`}`,
        type: 'team_match',
        title: homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : group.name,
        startsAt,
        endsAt: addClubCalendarMinutes(startsAt, Math.max(60, group.defaultDurationMinutes || 120)),
        allDay: !cleanClubText(row.match_time, 20),
        locationLabel: cleanClubText(row.facility) || group.locationLabel || club.locationLabel,
        courtLabel: '',
        groupId: group.id,
        groupName: group.name,
        membershipIds: memberIdsByGroup.get(group.id) ?? [],
        href: `/captain?clubId=${encodeURIComponent(club.id)}&clubName=${encodeURIComponent(club.name)}&club=${encodeURIComponent(club.slug)}&groupId=${encodeURIComponent(group.id)}&team=${encodeURIComponent(group.name)}`,
        needsResult: date < today && !cleanClubText(row.winner_side) && !cleanClubText(row.score) && cleanClubText(row.status) !== 'completed',
      })
    }
  }

  for (const row of (leagueScheduleResult.data ?? []) as Record<string, unknown>[]) {
    const leagueId = cleanClubText(row.league_id)
    const league = leagueById.get(leagueId)
    const date = cleanClubText(row.scheduled_date, 20)
    if (!league || !date || date < resultLookback) continue
    const groupId = cleanClubText(league.club_group_id)
    const group = groupById.get(groupId)
    const time = cleanClubText(row.scheduled_time, 20)
    const startsAt = buildClubCalendarDateTime(date, time)
    const participantA = cleanClubText(row.participant_a_name, 120)
    const participantB = cleanClubText(row.participant_b_name, 120)
    const participantTeamMembershipIds = teamGroups
      .filter((team) => [participantA, participantB].some((participant) => getTeamNameKeys(participant).some((key) => getTeamNameKeys(team.name).includes(key))))
      .flatMap((team) => memberIdsByGroup.get(team.id) ?? [])
    calendarEvents.push({
      id: `league:${cleanClubText(row.id) || `${leagueId}:${date}:${participantA}:${participantB}`}`,
      type: 'league_match',
      title: participantA && participantB ? `${participantA} vs ${participantB}` : cleanClubText(league.league_name),
      startsAt,
      endsAt: addClubCalendarMinutes(startsAt, 120),
      allDay: !time,
      locationLabel: cleanClubText(row.facility) || cleanClubText(league.location_label) || club.locationLabel,
      courtLabel: '',
      groupId,
      groupName: group?.name || cleanClubText(league.league_name),
      membershipIds: Array.from(new Set([...(memberIdsByLeague.get(leagueId) ?? []), ...participantTeamMembershipIds])),
      href: `/league-coordinator?leagueId=${encodeURIComponent(leagueId)}`,
      needsResult: date < today && cleanClubText(row.status) !== 'completed',
    })
  }

  for (const row of (tournamentResult.data ?? []) as Record<string, unknown>[]) {
    const tournamentId = cleanClubText(row.id)
    const tournamentName = cleanClubText(row.name)
    const groupId = cleanClubText(row.club_group_id)
    const group = groupById.get(groupId)
    const href = `/league-coordinator/tournaments?tournamentId=${encodeURIComponent(tournamentId)}`
    const locationLabel = cleanClubText(row.location_label) || group?.locationLabel || club.locationLabel
    const schedule = row.schedule && typeof row.schedule === 'object' && !Array.isArray(row.schedule)
      ? Object.entries(row.schedule as Record<string, unknown>)
      : []
    let scheduledEventCount = 0
    for (const [matchId, rawItem] of schedule) {
      const item = rawItem && typeof rawItem === 'object' ? rawItem as Record<string, unknown> : {}
      const date = cleanClubText(item.date, 20)
      if (!date || date < resultLookback) continue
      const time = cleanClubText(item.time, 20)
      const courtLabel = cleanClubText(item.court, 120)
      const startsAt = buildClubCalendarDateTime(date, time)
      scheduledEventCount += 1
      calendarEvents.push({
        id: `tournament:${tournamentId}:${cleanClubText(matchId)}`,
        type: 'tournament_match',
        title: courtLabel ? `${tournamentName} · ${courtLabel}` : tournamentName,
        startsAt,
        endsAt: addClubCalendarMinutes(startsAt, 120),
        allDay: !time,
        locationLabel,
        courtLabel,
        groupId,
        groupName: group?.name || tournamentName,
        membershipIds: memberIdsByTournament.get(tournamentId) ?? [],
        href,
        needsResult: date < today && !getClubCalendarTournamentResult(row.results, matchId),
      })
    }
    const startsOn = cleanClubText(row.starts_on, 20)
    if (!scheduledEventCount && startsOn && startsOn >= today) calendarEvents.push({
      id: `tournament:${tournamentId}:start`,
      type: 'tournament_match',
      title: tournamentName,
      startsAt: buildClubCalendarDateTime(startsOn, ''),
      endsAt: addClubCalendarMinutes(buildClubCalendarDateTime(startsOn, ''), 120),
      allDay: true,
      locationLabel,
      courtLabel: '',
      groupId,
      groupName: group?.name || tournamentName,
      membershipIds: memberIdsByTournament.get(tournamentId) ?? [],
      href,
      needsResult: false,
    })
  }

  calendarEvents.sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.title.localeCompare(right.title))

  return Response.json({
    ok: true,
    clubs,
    memberships,
    workspace: {
      club,
      currentMembership,
      memberships: workspaceMemberships,
      invites: ((inviteResult.data ?? []) as Record<string, unknown>[]).map(mapClubInviteRow),
      groups: groups.map((group) => {
        const renewalCounts = renewalCountsByGroup.get(group.id) ?? { pending: 0, confirmed: 0, declined: 0 }
        const clinicSchedule = clinicScheduleByGroup.get(group.id) ?? { count: 0, nextAt: '' }
        const teamReadiness = teamReadinessByGroup.get(group.id) ?? { rosterCount: 0, matchCount: 0, nextAt: '' }
        const coachReadiness = coachReadinessByGroup.get(group.id) ?? { expectedCount: 0, linkedCount: 0, plannedCount: 0, nextAt: '', actionPlayerLinkId: '' }
        const linkedCompetition = competitionByGroupId.get(group.id)
        return {
          ...group,
          memberIds: memberIdsByGroup.get(group.id) ?? [],
          reviewMemberIds: reviewMemberIdsByGroup.get(group.id) ?? [],
          renewalPendingCount: renewalCounts.pending,
          renewalConfirmedCount: renewalCounts.confirmed,
          renewalDeclinedCount: renewalCounts.declined,
          clinicSessionCount: clinicSchedule.count,
          nextClinicSessionAt: clinicSchedule.nextAt,
          teamRosterCount: teamReadiness.rosterCount,
          teamMatchCount: teamReadiness.matchCount,
          nextTeamMatchAt: teamReadiness.nextAt,
          coachExpectedPlayerCount: coachReadiness.expectedCount,
          coachLinkedPlayerCount: coachReadiness.linkedCount,
          coachPlannedPlayerCount: coachReadiness.plannedCount,
          nextCoachSessionAt: coachReadiness.nextAt,
          coachActionPlayerLinkId: coachReadiness.actionPlayerLinkId,
          linkedCompetitionId: linkedCompetition?.id ?? '',
          linkedCompetitionType: linkedCompetition?.type ?? '',
          competitionEntryCount: linkedCompetition?.entryCount ?? 0,
          competitionScheduleCount: linkedCompetition?.scheduleCount ?? 0,
          nextCompetitionEventAt: linkedCompetition?.nextEventAt ?? '',
        }
      }),
      templates: ((templateResult.data ?? []) as Record<string, unknown>[]).map(mapClubTemplateRow),
      competitions,
      calendarEvents,
    },
  })
}

function buildClubCalendarDateTime(date: string, rawTime: string) {
  const time = normalizeClubCalendarTime(rawTime) || '12:00:00'
  return `${date.slice(0, 10)}T${time}`
}

function getClubCalendarToday(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timeZone || 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
    return `${value('year')}-${value('month')}-${value('day')}`
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function getClubCalendarDateOffset(timeZone: string, dayOffset: number) {
  const today = getClubCalendarToday(timeZone)
  const date = new Date(`${today}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + dayOffset)
  return date.toISOString().slice(0, 10)
}

function getClubCalendarTournamentResult(value: unknown, matchId: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return (value as Record<string, unknown>)[matchId] ?? null
}

function normalizeClubCalendarTime(value: string) {
  const normalized = cleanClubText(value, 20).toUpperCase()
  const twentyFourHour = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (twentyFourHour) return `${twentyFourHour[1].padStart(2, '0')}:${twentyFourHour[2]}:00`
  const twelveHour = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
  if (!twelveHour) return ''
  let hour = Number(twelveHour[1]) % 12
  if (twelveHour[3] === 'PM') hour += 12
  return `${String(hour).padStart(2, '0')}:${twelveHour[2]}:00`
}

function addClubCalendarMinutes(startsAt: string, minutes: number) {
  const date = new Date(`${startsAt}Z`)
  if (!Number.isFinite(date.getTime())) return startsAt
  date.setUTCMinutes(date.getUTCMinutes() + minutes)
  return date.toISOString().slice(0, 19)
}

export async function POST(request: Request) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, message: 'Check the club details and try again.' }, { status: 400 })
  }

  const name = cleanClubText(body.name, 120)
  if (name.length < 2) return Response.json({ ok: false, message: 'Enter the club name.' }, { status: 400 })

  const baseSlug = createClubSlug(body.slug || name) || `club-${crypto.randomUUID().slice(0, 8)}`
  const payload = {
    owner_user_id: auth.userId,
    name,
    slug: baseSlug,
    description: cleanClubMultiline(body.description),
    location_label: cleanClubText(body.locationLabel),
    contact_email: cleanClubText(body.contactEmail, 180).toLowerCase(),
    time_zone: cleanClubText(body.timeZone, 80) || 'America/Chicago',
    primary_color: normalizeClubColor(body.primaryColor),
    is_public: body.isPublic !== false,
  }

  let result = await auth.supabase.from('clubs').insert(payload).select(clubSelect).single()
  if (result.error?.code === '23505') {
    result = await auth.supabase
      .from('clubs')
      .insert({ ...payload, slug: `${baseSlug}-${crypto.randomUUID().slice(0, 6)}` })
      .select(clubSelect)
      .single()
  }
  if (result.error) return clubDatabaseError(result.error.message)

  return Response.json({ ok: true, club: mapClubRow(result.data as Record<string, unknown>) })
}

function clubDatabaseError(message: string) {
  const missingSchema = message.toLowerCase().includes('club_') || message.toLowerCase().includes("could not find the table 'public.clubs'")
  return Response.json(
    {
      ok: false,
      message: missingSchema
        ? 'Club is ready in the app, but its database update has not been applied yet.'
        : 'Club could not load. Try again in a moment.',
    },
    { status: 500 },
  )
}

function getTeamNameKeys(value: unknown) {
  const normalized = cleanClubText(value).replace(/\s+/g, ' ').toLowerCase()
  if (!normalized) return []
  return Array.from(new Set([normalized, normalized.replace(/\s*\/\s*/g, '/')]))
}

function coachAssignmentMatchesGroup(value: unknown, groupId: string) {
  const assignment = getRecord(value)
  const assignedGroupId = cleanClubText(assignment?.clubGroupId)
  return !assignedGroupId || assignedGroupId === groupId
}

function getCoachLessonDateTime(value: unknown) {
  return cleanClubText(getRecord(value)?.lessonDateTime, 80)
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
