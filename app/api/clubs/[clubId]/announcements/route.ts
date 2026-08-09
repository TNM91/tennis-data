import { getClubApiAuth } from '@/lib/club-api-auth'
import { canRunClubPrograms, cleanClubMultiline, cleanClubText, normalizeClubRoles } from '@/lib/club-workspace'

export const runtime = 'nodejs'

const historySelect = 'id,club_id,author_user_id,author_name,body,destinations,created_at'

export async function GET(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params
  const membership = await loadClubStaffMembership(auth.supabase, clubId, auth.userId)
  if (!membership.ok) return membership.response

  const result = await auth.supabase
    .from('club_announcement_history')
    .select(historySelect)
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(40)
  if (result.error) return announcementDatabaseError(result.error.message)

  return Response.json({
    ok: true,
    announcements: ((result.data ?? []) as Record<string, unknown>[]).map(mapClubAnnouncementRow),
  })
}

export async function POST(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params
  const membership = await loadClubStaffMembership(auth.supabase, clubId, auth.userId)
  if (!membership.ok) return membership.response

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, message: 'Check the announcement details.' }, { status: 400 })
  }
  const message = cleanClubMultiline(body.body, 2000)
  const destinations = cleanDestinations(body.destinations)
  if (!message) return Response.json({ ok: false, message: 'Write the announcement first.' }, { status: 400 })
  if (!destinations.length) return Response.json({ ok: false, message: 'Choose at least one team or clinic.' }, { status: 400 })

  const result = await auth.supabase
    .from('club_announcement_history')
    .insert({
      club_id: clubId,
      author_user_id: auth.userId,
      author_name: membership.name,
      body: message,
      destinations,
    })
    .select(historySelect)
    .single()
  if (result.error) return announcementDatabaseError(result.error.message)

  return Response.json({ ok: true, announcement: mapClubAnnouncementRow(result.data as Record<string, unknown>) })
}

async function loadClubStaffMembership(supabase: Extract<Awaited<ReturnType<typeof getClubApiAuth>>, { ok: true }>['supabase'], clubId: string, userId: string) {
  const result = await supabase
    .from('club_memberships')
    .select('display_name,email,roles,status')
    .eq('club_id', clubId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (result.error) return { ok: false as const, response: announcementDatabaseError(result.error.message) }
  if (!result.data || !canRunClubPrograms(normalizeClubRoles(result.data.roles))) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Club staff access is required to view announcements.' }, { status: 403 }) }
  }
  return {
    ok: true as const,
    name: cleanClubText(result.data.display_name, 120) || cleanClubText(result.data.email, 180) || 'Club staff',
  }
}

function cleanDestinations(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 50).flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    const groupId = cleanClubText(row.groupId, 120)
    const name = cleanClubText(row.name, 120)
    const type = row.type === 'team' ? 'team' : row.type === 'clinic' ? 'clinic' : ''
    const rawHref = cleanClubText(row.href, 800)
    const href = rawHref.startsWith('/team-room') || rawHref.startsWith('/clubs/clinics/') ? rawHref : ''
    return groupId && name && type && href ? [{ groupId, name, type, href }] : []
  })
}

function mapClubAnnouncementRow(row: Record<string, unknown>) {
  return {
    id: cleanClubText(row.id),
    clubId: cleanClubText(row.club_id),
    authorUserId: cleanClubText(row.author_user_id),
    authorName: cleanClubText(row.author_name, 180) || 'Club staff',
    body: cleanClubMultiline(row.body, 2000),
    destinations: cleanDestinations(row.destinations),
    createdAt: cleanClubText(row.created_at, 80),
  }
}

function announcementDatabaseError(message: string) {
  const missingSchema = message.toLowerCase().includes('club_announcement_history')
  return Response.json({
    ok: false,
    message: missingSchema
      ? 'Club announcement history is ready in the app, but its database update has not been applied yet.'
      : 'Club announcement history could not load. Try again.',
  }, { status: 500 })
}
