import { getClubApiAuth } from '@/lib/club-api-auth'
import {
  cleanClubMultiline,
  cleanClubText,
  createClubSlug,
  mapClubGroupRow,
  mapClubInviteRow,
  mapClubMembershipRow,
  mapClubRow,
  mapClubTemplateRow,
  normalizeClubColor,
  type ClubLinkedCompetition,
} from '@/lib/club-workspace'

export const runtime = 'nodejs'

const clubSelect = 'id,owner_user_id,name,slug,description,logo_url,hero_image_url,primary_color,location_label,contact_email,time_zone,is_public,onboarding_completed_at,created_at,updated_at'
const membershipSelect = 'id,club_id,user_id,roles,status,display_name,email,phone,joined_at,updated_at'
const groupSelect = 'id,club_id,name,group_type,description,season_label,lead_user_id,capacity,location_label,registration_url,default_duration_minutes,is_public,is_active,updated_at'
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
    auth.supabase.from('club_groups').select(groupSelect).eq('club_id', club.id).eq('is_active', true).order('updated_at', { ascending: false }),
    auth.supabase.from('club_competition_templates').select(templateSelect).eq('club_id', club.id).order('updated_at', { ascending: false }),
    auth.supabase.from('club_invites').select(inviteSelect).eq('club_id', club.id).eq('status', 'pending').order('created_at', { ascending: false }),
    auth.supabase.from('tiq_leagues').select('id,league_name,season_status,is_public').eq('club_id', club.id).order('updated_at', { ascending: false }),
    auth.supabase.from('tiq_tournaments').select('id,name,status,is_public').eq('club_id', club.id).order('updated_at', { ascending: false }),
  ])

  const firstError = [memberResult.error, groupResult.error, templateResult.error, inviteResult.error, leagueResult.error, tournamentResult.error].find(Boolean)
  if (firstError) return clubDatabaseError(firstError.message)

  const groups = ((groupResult.data ?? []) as Record<string, unknown>[]).map((row) => mapClubGroupRow(row))
  let groupMemberRows: Record<string, unknown>[] = []
  if (groups.length) {
    const result = await auth.supabase
      .from('club_group_members')
      .select('group_id,membership_id,status')
      .in('group_id', groups.map((group) => group.id))
      .neq('status', 'inactive')
    if (result.error) return clubDatabaseError(result.error.message)
    groupMemberRows = (result.data ?? []) as Record<string, unknown>[]
  }

  const memberIdsByGroup = new Map<string, string[]>()
  for (const row of groupMemberRows) {
    const groupId = cleanClubText(row.group_id)
    const membershipId = cleanClubText(row.membership_id)
    if (groupId && membershipId && row.status === 'active') memberIdsByGroup.set(groupId, [...(memberIdsByGroup.get(groupId) ?? []), membershipId])
  }

  const competitions: ClubLinkedCompetition[] = [
    ...((leagueResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: cleanClubText(row.id),
      name: cleanClubText(row.league_name),
      type: 'league' as const,
      status: cleanClubText(row.season_status) || 'draft',
      isPublic: row.is_public !== false,
      href: `/league-coordinator?leagueId=${encodeURIComponent(cleanClubText(row.id))}`,
    })),
    ...((tournamentResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: cleanClubText(row.id),
      name: cleanClubText(row.name),
      type: 'tournament' as const,
      status: cleanClubText(row.status) || 'draft',
      isPublic: row.is_public !== false,
      href: `/league-coordinator/tournaments?tournamentId=${encodeURIComponent(cleanClubText(row.id))}`,
    })),
  ]

  return Response.json({
    ok: true,
    clubs,
    memberships,
    workspace: {
      club,
      currentMembership,
      memberships: ((memberResult.data ?? []) as Record<string, unknown>[]).map(mapClubMembershipRow),
      invites: ((inviteResult.data ?? []) as Record<string, unknown>[]).map(mapClubInviteRow),
      groups: groups.map((group) => ({ ...group, memberIds: memberIdsByGroup.get(group.id) ?? [] })),
      templates: ((templateResult.data ?? []) as Record<string, unknown>[]).map(mapClubTemplateRow),
      competitions,
    },
  })
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
