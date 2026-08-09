import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminApiAuth } from '@/lib/admin-api-auth'
import { canDeleteClubWithConfirmation, countClubRows, type AdminClubSummary } from '@/lib/admin-clubs'
import { CLUB_BRANDING_BUCKET } from '@/lib/club-branding'

export const runtime = 'nodejs'

type ClubRow = {
  id: string
  name: string
  slug: string
  location_label: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export async function GET(request: Request) {
  const auth = await getAdminApiAuth(request)
  if (!auth.ok) return auth.response

  const [clubsResult, membershipsResult, programsResult] = await Promise.all([
    auth.service
      .from('clubs')
      .select('id,name,slug,location_label,is_public,created_at,updated_at')
      .order('updated_at', { ascending: false }),
    auth.service.from('club_memberships').select('club_id').neq('status', 'removed'),
    auth.service.from('club_groups').select('club_id').eq('is_active', true),
  ])

  const firstError = clubsResult.error || membershipsResult.error || programsResult.error
  if (firstError) {
    return Response.json({ ok: false, message: 'Club accounts could not be loaded.' }, { status: 500 })
  }

  const memberCounts = countClubRows(membershipsResult.data)
  const programCounts = countClubRows(programsResult.data)
  const clubs = ((clubsResult.data ?? []) as ClubRow[]).map<AdminClubSummary>((club) => ({
    id: club.id,
    name: club.name,
    slug: club.slug,
    locationLabel: club.location_label || '',
    isPublic: club.is_public,
    memberCount: memberCounts.get(club.id) ?? 0,
    programCount: programCounts.get(club.id) ?? 0,
    createdAt: club.created_at,
    updatedAt: club.updated_at,
  }))

  return Response.json({ ok: true, clubs })
}

export async function DELETE(request: Request) {
  const auth = await getAdminApiAuth(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null) as { clubId?: unknown; confirmationName?: unknown } | null
  const clubId = typeof body?.clubId === 'string' ? body.clubId.trim() : ''
  if (!clubId) return Response.json({ ok: false, message: 'Choose a club to delete.' }, { status: 400 })

  const clubResult = await auth.service
    .from('clubs')
    .select('id,name,slug')
    .eq('id', clubId)
    .maybeSingle()
  if (clubResult.error) return Response.json({ ok: false, message: 'The club could not be checked.' }, { status: 500 })
  if (!clubResult.data) return Response.json({ ok: false, message: 'That club no longer exists.' }, { status: 404 })
  if (!canDeleteClubWithConfirmation(clubResult.data.name, body?.confirmationName)) {
    return Response.json({ ok: false, message: `Type ${clubResult.data.name} to confirm deletion.` }, { status: 400 })
  }

  const deletion = await auth.service
    .from('clubs')
    .delete()
    .eq('id', clubId)
    .select('id,name')
    .single()
  if (deletion.error) {
    return Response.json({ ok: false, message: 'The club could not be deleted. Check linked records and try again.' }, { status: 500 })
  }

  const storageWarning = await removeClubBranding(auth.service, clubId)
  const auditResult = await auth.service.from('admin_audit_events').insert({
    actor_user_id: auth.userId,
    action: 'club_deleted',
    target_type: 'club',
    target_id: clubId,
    target_label: clubResult.data.name,
    metadata: { slug: clubResult.data.slug, storageWarning },
  })
  const warning = [
    storageWarning,
    auditResult.error ? 'The club was deleted, but its audit entry could not be saved.' : '',
  ].filter(Boolean).join(' ')

  return Response.json({
    ok: true,
    deletedClub: { id: clubId, name: clubResult.data.name },
    message: `${clubResult.data.name} was deleted.`,
    warning,
  })
}

async function removeClubBranding(service: SupabaseClient, clubId: string) {
  const listing = await service.storage.from(CLUB_BRANDING_BUCKET).list(clubId, { limit: 1000 })
  if (listing.error) return 'The club was deleted, but its stored branding could not be checked.'
  const paths = (listing.data ?? []).filter((file) => file.name).map((file) => `${clubId}/${file.name}`)
  if (!paths.length) return ''
  const removal = await service.storage.from(CLUB_BRANDING_BUCKET).remove(paths)
  return removal.error ? 'The club was deleted, but some stored branding may remain.' : ''
}
