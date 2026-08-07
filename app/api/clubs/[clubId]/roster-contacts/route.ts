import { getClubApiAuth } from '@/lib/club-api-auth'
import { getClubRosterConnectionStatus } from '@/lib/club-roster-reconciliation'
import { cleanClubText, isClubManager, normalizeClubRoles } from '@/lib/club-workspace'

export const runtime = 'nodejs'

type RosterContactBody = {
  contactIds?: unknown
  share?: unknown
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
      .select('email,phone,status')
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

  return Response.json({
    ok: true,
    contacts: (data ?? []).map((contact) => ({
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
      teamName: cleanClubText(contact.team_name),
      leagueName: cleanClubText(contact.league_name),
      flight: cleanClubText(contact.flight),
      fullName: cleanClubText(contact.full_name),
      phone: cleanClubText(contact.phone, 40),
      email: cleanClubText(contact.email, 180).toLowerCase(),
      role: cleanClubText(contact.role, 40) || 'Player',
      isCaptain: contact.is_captain === true,
      updatedAt: cleanClubText(contact.updated_at, 80),
    })),
  })
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
