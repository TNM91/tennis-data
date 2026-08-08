import { getClubApiAuth } from '@/lib/club-api-auth'
import { findClubRosterMembership, getClubRosterConnectionStatus, normalizeClubContactEmail, normalizeClubContactPhone } from '@/lib/club-roster-reconciliation'
import { cleanClubText, isClubManager, normalizeClubRoles } from '@/lib/club-workspace'

export const runtime = 'nodejs'

type RosterContactBody = {
  contactIds?: unknown
  membershipIds?: unknown
  share?: unknown
  targetType?: unknown
  targetId?: unknown
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function requireClubManager(request: Request, clubId: string) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth
  if (!uuidPattern.test(clubId)) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Choose a valid club.' }, { status: 400 }) }
  }

  const { data: membership } = await auth.supabase
    .from('club_memberships')
    .select('roles')
    .eq('club_id', clubId)
    .eq('user_id', auth.userId)
    .eq('status', 'active')
    .maybeSingle()
  if (!membership || !isClubManager(normalizeClubRoles(membership.roles, []))) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Club manager access is required to use imported roster contacts.' }, { status: 403 }) }
  }
  return auth
}

export async function GET(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await context.params
  const auth = await requireClubManager(request, clubId)
  if (!auth.ok) return auth.response

  const [ownResult, shareResult, membershipResult, inviteResult] = await Promise.all([
    auth.supabase
      .from('captain_roster_contacts')
      .select('id,captain_user_id,team_name,league_name,flight,full_name,phone,email,role,is_captain,updated_at')
      .eq('captain_user_id', auth.userId)
      .order('team_name')
      .order('full_name'),
    auth.supabase
      .from('club_roster_contact_shares')
      .select('contact_id,shared_by_user_id')
      .eq('club_id', clubId),
    auth.supabase
      .from('club_memberships')
      .select('id,user_id,display_name,email,phone,status')
      .eq('club_id', clubId)
      .neq('status', 'removed'),
    auth.supabase
      .from('club_invites')
      .select('email,status,expires_at')
      .eq('club_id', clubId)
      .eq('status', 'pending'),
  ])
  const { data: ownContacts, error: ownContactsError } = ownResult
  const { data: shares, error: sharesError } = shareResult
  if (ownContactsError || sharesError || membershipResult.error || inviteResult.error) {
    return Response.json({ ok: false, message: 'Imported roster contacts could not be opened.' }, { status: 400 })
  }

  const sharedContactIds = Array.from(new Set((shares ?? []).map((share) => cleanClubText(share.contact_id)).filter(Boolean)))
  const sharedResult = sharedContactIds.length
    ? await auth.supabase
        .from('captain_roster_contacts')
        .select('id,captain_user_id,team_name,league_name,flight,full_name,phone,email,role,is_captain,updated_at')
        .in('id', sharedContactIds)
    : { data: [], error: null }
  if (sharedResult.error) {
    return Response.json({ ok: false, message: 'Shared roster contacts could not be opened.' }, { status: 400 })
  }
  const contactMap = new Map<string, (NonNullable<typeof ownContacts>)[number]>()
  for (const contact of [...(ownContacts ?? []), ...(sharedResult.data ?? [])]) {
    contactMap.set(cleanClubText(contact.id), contact)
  }
  const data = Array.from(contactMap.values()).sort((left, right) => (
    `${left.team_name}\u0000${left.full_name}`.localeCompare(`${right.team_name}\u0000${right.full_name}`)
  ))
  const sharedContactIdSet = new Set(sharedContactIds)

  const ownerIds = Array.from(new Set((data ?? []).map((contact) => cleanClubText(contact.captain_user_id)).filter(Boolean)))
  const { data: owners } = ownerIds.length
    ? await auth.supabase
        .from('club_memberships')
        .select('user_id,display_name,email')
        .eq('club_id', clubId)
        .in('user_id', ownerIds)
    : { data: [] }
  const ownerNames = new Map((owners ?? []).map((owner) => [
    cleanClubText(owner.user_id),
    cleanClubText(owner.display_name, 120) || cleanClubText(owner.email, 180) || 'Club manager',
  ]))

  const [groupResult, leagueResult, tournamentResult] = await Promise.all([
    auth.supabase.from('club_groups').select('id,name,group_type').eq('club_id', clubId).eq('is_active', true),
    auth.supabase.from('tiq_leagues').select('id,league_name').eq('club_id', clubId).eq('league_format', 'individual'),
    auth.supabase.from('tiq_tournaments').select('id,name').eq('club_id', clubId).eq('entrant_type', 'players'),
  ])
  if (groupResult.error || leagueResult.error || tournamentResult.error) {
    return Response.json({ ok: false, message: 'Player destinations could not be opened.' }, { status: 400 })
  }

  const groupIds = (groupResult.data ?? []).map((group) => cleanClubText(group.id)).filter(Boolean)
  const leagueIds = (leagueResult.data ?? []).map((league) => cleanClubText(league.id)).filter(Boolean)
  const tournamentIds = (tournamentResult.data ?? []).map((tournament) => cleanClubText(tournament.id)).filter(Boolean)
  const [groupMemberResult, leagueEntryResult, tournamentEntryResult] = await Promise.all([
    groupIds.length
      ? auth.supabase.from('club_group_members').select('group_id,membership_id,status').in('group_id', groupIds).neq('status', 'inactive')
      : Promise.resolve({ data: [], error: null }),
    leagueIds.length
      ? auth.supabase.from('tiq_player_league_entries').select('league_id,club_membership_id').in('league_id', leagueIds).eq('entry_status', 'active').not('club_membership_id', 'is', null)
      : Promise.resolve({ data: [], error: null }),
    tournamentIds.length
      ? auth.supabase.from('tiq_tournament_entries').select('tournament_id,club_membership_id').in('tournament_id', tournamentIds).eq('status', 'approved').not('club_membership_id', 'is', null)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (groupMemberResult.error || leagueEntryResult.error || tournamentEntryResult.error) {
    return Response.json({ ok: false, message: 'Player destinations could not be opened.' }, { status: 400 })
  }

  const destinationsByMembershipId = new Map<string, Array<{ type: 'group' | 'league' | 'tournament'; id: string; name: string; label: string }>>()
  const addDestination = (membershipId: unknown, destination: { type: 'group' | 'league' | 'tournament'; id: string; name: string; label: string }) => {
    const key = cleanClubText(membershipId)
    if (!key) return
    destinationsByMembershipId.set(key, [...(destinationsByMembershipId.get(key) ?? []), destination])
  }
  const groupsById = new Map((groupResult.data ?? []).map((group) => [cleanClubText(group.id), group]))
  for (const item of groupMemberResult.data ?? []) {
    const group = groupsById.get(cleanClubText(item.group_id))
    if (group) addDestination(item.membership_id, { type: 'group', id: cleanClubText(group.id), name: cleanClubText(group.name), label: `${getDestinationTypeLabel(group.group_type)}${item.status === 'waitlist' ? ' · Review' : ''}` })
  }
  const leaguesById = new Map((leagueResult.data ?? []).map((league) => [cleanClubText(league.id), league]))
  for (const item of leagueEntryResult.data ?? []) {
    const league = leaguesById.get(cleanClubText(item.league_id))
    if (league) addDestination(item.club_membership_id, { type: 'league', id: cleanClubText(league.id), name: cleanClubText(league.league_name), label: 'League' })
  }
  const tournamentsById = new Map((tournamentResult.data ?? []).map((tournament) => [cleanClubText(tournament.id), tournament]))
  for (const item of tournamentEntryResult.data ?? []) {
    const tournament = tournamentsById.get(cleanClubText(item.tournament_id))
    if (tournament) addDestination(item.club_membership_id, { type: 'tournament', id: cleanClubText(tournament.id), name: cleanClubText(tournament.name), label: 'Tournament' })
  }

  return Response.json({
    ok: true,
    contacts: (data ?? []).map((contact) => {
      const matchedMembership = findClubRosterMembership(contact, membershipResult.data ?? [])
      return {
        id: cleanClubText(contact.id),
        importedByUserId: cleanClubText(contact.captain_user_id),
        importedByName: contact.captain_user_id === auth.userId ? 'You' : ownerNames.get(cleanClubText(contact.captain_user_id)) || 'Club manager',
        ownedByYou: contact.captain_user_id === auth.userId,
        sharedWithClub: sharedContactIdSet.has(cleanClubText(contact.id)),
        connectionStatus: getClubRosterConnectionStatus({
          contact,
          memberships: membershipResult.data ?? [],
          invites: inviteResult.data ?? [],
        }),
        matchedMembershipId: cleanClubText(matchedMembership?.id),
        matchedUserId: cleanClubText(matchedMembership?.user_id),
        connectedDestinations: destinationsByMembershipId.get(cleanClubText(matchedMembership?.id)) ?? [],
        teamName: cleanClubText(contact.team_name),
        leagueName: cleanClubText(contact.league_name),
        flight: cleanClubText(contact.flight),
        fullName: cleanClubText(contact.full_name),
        phone: cleanClubText(contact.phone, 40),
        email: cleanClubText(contact.email, 180).toLowerCase(),
        role: cleanClubText(contact.role, 40) || 'Player',
        isCaptain: contact.is_captain === true,
        updatedAt: cleanClubText(contact.updated_at, 80),
      }
    }),
  })
}

export async function PUT(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await context.params
  const auth = await requireClubManager(request, clubId)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({})) as RosterContactBody
  const membershipIds = Array.from(new Set(
    (Array.isArray(body.membershipIds) ? body.membershipIds : [])
      .map((value) => cleanClubText(value))
      .filter((value) => uuidPattern.test(value)),
  )).slice(0, 200)
  const targetType = cleanClubText(body.targetType)
  const targetId = cleanClubText(body.targetId, 180)
  if (!membershipIds.length) return Response.json({ ok: false, message: 'Choose at least one connected player.' }, { status: 400 })
  if (!['group', 'league', 'tournament'].includes(targetType) || !targetId) {
    return Response.json({ ok: false, message: 'Choose a team, clinic, league, or tournament.' }, { status: 400 })
  }

  const { data: memberships, error: membershipError } = await auth.supabase
    .from('club_memberships')
    .select('id,user_id,display_name,email,phone,status')
    .eq('club_id', clubId)
    .neq('status', 'removed')
    .in('id', membershipIds)
  if (membershipError || (memberships ?? []).length !== membershipIds.length) {
    return Response.json({ ok: false, message: 'Every selected player must still be connected to this club.' }, { status: 409 })
  }

  if (targetType === 'group') {
    const { data: group } = await auth.supabase
      .from('club_groups')
      .select('id,name')
      .eq('club_id', clubId)
      .eq('id', targetId)
      .eq('is_active', true)
      .maybeSingle()
    if (!group) return Response.json({ ok: false, message: 'That Club program is no longer available.' }, { status: 404 })
    const { error } = await auth.supabase.from('club_group_members').upsert(
      membershipIds.map((membershipId) => ({ group_id: targetId, membership_id: membershipId, status: 'active' })),
      { onConflict: 'group_id,membership_id' },
    )
    if (error) return Response.json({ ok: false, message: 'Connected players could not be added to this program.' }, { status: 400 })
    return Response.json({ ok: true, addedCount: membershipIds.length, message: `${membershipIds.length} connected ${membershipIds.length === 1 ? 'player is' : 'players are'} now in ${cleanClubText(group.name)}.` })
  }

  const entrants = (memberships ?? []).map((membership) => ({
    membership,
    playerName: cleanClubText(membership.display_name, 120) || cleanClubText(membership.email, 180),
  }))
  if (entrants.some((entrant) => !entrant.playerName)) return Response.json({ ok: false, message: 'Add names to the selected Club members first.' }, { status: 400 })

  if (targetType === 'league') {
    const { data: league } = await auth.supabase
      .from('tiq_leagues')
      .select('id,league_name,league_format')
      .eq('club_id', clubId)
      .eq('id', targetId)
      .maybeSingle()
    if (!league) return Response.json({ ok: false, message: 'That Club league is no longer available.' }, { status: 404 })
    if (league.league_format !== 'individual') {
      return Response.json({ ok: false, message: 'This league accepts teams. Add players to a Club team program instead.' }, { status: 400 })
    }

    const { data: existingEntries, error: existingError } = await auth.supabase
      .from('tiq_player_league_entries')
      .select('id,player_name,club_membership_id,entry_status')
      .eq('league_id', targetId)
    if (existingError) return Response.json({ ok: false, message: 'League entries could not be checked.' }, { status: 400 })
    const existingMatches = entrants.map((entrant) => ({
      entrant,
      existing: (existingEntries ?? []).find((entry) => cleanClubText(entry.club_membership_id) === cleanClubText(entrant.membership.id))
        ?? (existingEntries ?? []).find((entry) => normalizeComparable(entry.player_name) === normalizeComparable(entrant.playerName)),
    }))
    const updateResults = await Promise.all(existingMatches.filter((item) => item.existing).map((item) => auth.supabase
      .from('tiq_player_league_entries')
      .update({ club_membership_id: item.entrant.membership.id, entry_status: 'active', updated_by_user_id: auth.userId })
      .eq('id', item.existing!.id)))
    if (updateResults.some((result) => result.error)) {
      return Response.json({ ok: false, message: 'Existing league entries could not be activated.' }, { status: 400 })
    }
    const missingEntrants = existingMatches.filter((item) => !item.existing).map((item) => item.entrant)
    if (missingEntrants.length) {
      const { error } = await auth.supabase.from('tiq_player_league_entries').insert(missingEntrants.map((entrant) => ({
        league_id: targetId,
        club_membership_id: entrant.membership.id,
        player_name: entrant.playerName,
        entry_status: 'active',
        created_by_user_id: auth.userId,
        updated_by_user_id: auth.userId,
      })))
      if (error) return Response.json({ ok: false, message: 'Connected players could not be added to this league.' }, { status: 400 })
    }
    return Response.json({ ok: true, addedCount: entrants.length, message: `${entrants.length} connected ${entrants.length === 1 ? 'player is' : 'players are'} now in ${cleanClubText(league.league_name)}.` })
  }

  const { data: tournament } = await auth.supabase
    .from('tiq_tournaments')
    .select('id,name,entrant_type')
    .eq('club_id', clubId)
    .eq('id', targetId)
    .maybeSingle()
  if (!tournament) return Response.json({ ok: false, message: 'That Club tournament is no longer available.' }, { status: 404 })
  if (tournament.entrant_type !== 'players') {
    return Response.json({ ok: false, message: 'This tournament accepts teams. Add players to a Club team program instead.' }, { status: 400 })
  }

  const { data: existingEntries, error: existingError } = await auth.supabase
    .from('tiq_tournament_entries')
    .select('id,player_name,email,phone,club_membership_id,status')
    .eq('tournament_id', targetId)
  if (existingError) return Response.json({ ok: false, message: 'Tournament entries could not be checked.' }, { status: 400 })
  const existingIds: string[] = []
  const updateEntries: Array<{ id: string; clubMembershipId: string }> = []
  const newEntries: Array<{ tournament_id: string; club_membership_id: string; player_name: string; email: string; phone: string; status: string }> = []
  for (const membership of memberships ?? []) {
    const email = normalizeClubContactEmail(membership.email)
    const phone = normalizeClubContactPhone(membership.phone)
    const playerName = cleanClubText(membership.display_name, 120) || email
    const existing = (existingEntries ?? []).find((entry) => {
      if (cleanClubText(entry.club_membership_id) === cleanClubText(membership.id)) return true
      const entryEmail = normalizeClubContactEmail(entry.email)
      const entryPhone = normalizeClubContactPhone(entry.phone)
      return Boolean((email && entryEmail === email) || (phone && entryPhone === phone) || (!email && !phone && normalizeComparable(entry.player_name) === normalizeComparable(playerName)))
    })
    if (existing?.id) {
      existingIds.push(existing.id)
      updateEntries.push({ id: existing.id, clubMembershipId: membership.id })
    } else newEntries.push({ tournament_id: targetId, club_membership_id: membership.id, player_name: playerName, email, phone, status: 'approved' })
  }
  if (existingIds.length) {
    const updateResults = await Promise.all(updateEntries.map((entry) => auth.supabase
      .from('tiq_tournament_entries')
      .update({ club_membership_id: entry.clubMembershipId, status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', entry.id)))
    if (updateResults.some((result) => result.error)) return Response.json({ ok: false, message: 'Existing tournament entries could not be approved.' }, { status: 400 })
  }
  if (newEntries.length) {
    const { error } = await auth.supabase.from('tiq_tournament_entries').insert(newEntries)
    if (error) return Response.json({ ok: false, message: 'Connected players could not be added to this tournament.' }, { status: 400 })
  }
  return Response.json({ ok: true, addedCount: memberships?.length ?? 0, message: `${memberships?.length ?? 0} connected ${(memberships?.length ?? 0) === 1 ? 'player is' : 'players are'} now in ${cleanClubText(tournament.name)}.` })
}

export async function DELETE(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await context.params
  const auth = await requireClubManager(request, clubId)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({})) as RosterContactBody
  const membershipIds = Array.from(new Set(
    (Array.isArray(body.membershipIds) ? body.membershipIds : [])
      .map((value) => cleanClubText(value))
      .filter((value) => uuidPattern.test(value)),
  )).slice(0, 200)
  const targetType = cleanClubText(body.targetType)
  const targetId = cleanClubText(body.targetId, 180)
  if (!membershipIds.length) return Response.json({ ok: false, message: 'Choose at least one connected player.' }, { status: 400 })
  if (!['group', 'league', 'tournament'].includes(targetType) || !targetId) {
    return Response.json({ ok: false, message: 'Choose where the player should be removed.' }, { status: 400 })
  }

  const { data: memberships, error: membershipError } = await auth.supabase
    .from('club_memberships')
    .select('id')
    .eq('club_id', clubId)
    .neq('status', 'removed')
    .in('id', membershipIds)
  if (membershipError || (memberships ?? []).length !== membershipIds.length) {
    return Response.json({ ok: false, message: 'Every selected player must still be connected to this club.' }, { status: 409 })
  }

  if (targetType === 'group') {
    const { data: group } = await auth.supabase.from('club_groups').select('id,name').eq('club_id', clubId).eq('id', targetId).maybeSingle()
    if (!group) return Response.json({ ok: false, message: 'That Club program is no longer available.' }, { status: 404 })
    const { error } = await auth.supabase.from('club_group_members').delete().eq('group_id', targetId).in('membership_id', membershipIds)
    if (error) return Response.json({ ok: false, message: 'The selected players could not be removed from this program.' }, { status: 400 })
    return Response.json({ ok: true, message: `${membershipIds.length === 1 ? 'Player' : 'Players'} removed from ${cleanClubText(group.name)}.` })
  }

  if (targetType === 'league') {
    const { data: league } = await auth.supabase.from('tiq_leagues').select('id,league_name,league_format').eq('club_id', clubId).eq('id', targetId).maybeSingle()
    if (!league) return Response.json({ ok: false, message: 'That Club league is no longer available.' }, { status: 404 })
    if (league.league_format !== 'individual') return Response.json({ ok: false, message: 'Player removal is only available for individual Club leagues.' }, { status: 400 })
    const { error } = await auth.supabase.from('tiq_player_league_entries').delete().eq('league_id', targetId).in('club_membership_id', membershipIds)
    if (error) return Response.json({ ok: false, message: 'The selected players could not be removed from this league.' }, { status: 400 })
    return Response.json({ ok: true, message: `${membershipIds.length === 1 ? 'Player' : 'Players'} removed from ${cleanClubText(league.league_name)}.` })
  }

  const { data: tournament } = await auth.supabase.from('tiq_tournaments').select('id,name,entrant_type').eq('club_id', clubId).eq('id', targetId).maybeSingle()
  if (!tournament) return Response.json({ ok: false, message: 'That Club tournament is no longer available.' }, { status: 404 })
  if (tournament.entrant_type !== 'players') return Response.json({ ok: false, message: 'Player removal is only available for player-entry Club tournaments.' }, { status: 400 })
  const { error } = await auth.supabase.from('tiq_tournament_entries').delete().eq('tournament_id', targetId).in('club_membership_id', membershipIds)
  if (error) return Response.json({ ok: false, message: 'The selected players could not be removed from this tournament.' }, { status: 400 })
  return Response.json({ ok: true, message: `${membershipIds.length === 1 ? 'Player' : 'Players'} removed from ${cleanClubText(tournament.name)}.` })
}

export async function PATCH(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await context.params
  const auth = await requireClubManager(request, clubId)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({})) as RosterContactBody
  const contactIds = Array.from(new Set(
    (Array.isArray(body.contactIds) ? body.contactIds : [])
      .map((value) => cleanClubText(value))
      .filter((value) => uuidPattern.test(value)),
  )).slice(0, 500)
  const share = body.share === true
  if (!contactIds.length) {
    return Response.json({ ok: false, message: 'Choose an imported team roster first.' }, { status: 400 })
  }

  const { data: ownedContacts, error: readError } = await auth.supabase
    .from('captain_roster_contacts')
    .select('id')
    .eq('captain_user_id', auth.userId)
    .in('id', contactIds)
  if (readError || (share && (ownedContacts ?? []).length !== contactIds.length)) {
    return Response.json({ ok: false, message: 'Only the manager who imported this roster can change its sharing.' }, { status: 403 })
  }
  const { data: existingShares, error: shareReadError } = await auth.supabase
    .from('club_roster_contact_shares')
    .select('contact_id')
    .eq('club_id', clubId)
    .in('contact_id', contactIds)
  if (shareReadError) {
    return Response.json({ ok: false, message: 'Roster sharing could not be updated.' }, { status: 400 })
  }
  if (!share && (existingShares ?? []).length !== contactIds.length) {
    return Response.json({ ok: false, message: 'This roster is not fully shared with this club.' }, { status: 409 })
  }

  const existingContactIds = new Set((existingShares ?? []).map((item) => cleanClubText(item.contact_id)))
  const missingContactIds = contactIds.filter((contactId) => !existingContactIds.has(contactId))
  const mutation = share
    ? missingContactIds.length
      ? await auth.supabase.from('club_roster_contact_shares').insert(missingContactIds.map((contactId) => ({
          contact_id: contactId,
          club_id: clubId,
          shared_by_user_id: auth.userId,
        })))
      : { error: null }
    : await auth.supabase
        .from('club_roster_contact_shares')
        .delete()
        .eq('club_id', clubId)
        .in('contact_id', contactIds)
  if (mutation.error) {
    return Response.json({ ok: false, message: 'Roster sharing could not be updated.' }, { status: 400 })
  }

  return Response.json({
    ok: true,
    updatedCount: contactIds.length,
    message: share
      ? 'This roster is now available to authorized club managers.'
      : 'This roster is no longer shared with this club.',
  })
}

function normalizeComparable(value: unknown) {
  return cleanClubText(value, 180).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function getDestinationTypeLabel(value: unknown) {
  const type = cleanClubText(value)
  if (type === 'clinic') return 'Clinic'
  if (type === 'team') return 'Team'
  if (type === 'camp') return 'Camp'
  if (type === 'development_group') return 'Development group'
  if (type === 'league_division') return 'League division'
  if (type === 'tournament_field') return 'Tournament field'
  return 'Program'
}
