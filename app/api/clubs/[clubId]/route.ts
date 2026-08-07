import { getClubApiAuth } from '@/lib/club-api-auth'
import { cleanClubMultiline, cleanClubText, mapClubRow, normalizeClubColor } from '@/lib/club-workspace'

export const runtime = 'nodejs'

export async function PATCH(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, message: 'Check the club details and try again.' }, { status: 400 })
  }

  const payload = {
    name: cleanClubText(body.name, 120),
    description: cleanClubMultiline(body.description),
    logo_url: cleanClubText(body.logoUrl, 800),
    hero_image_url: cleanClubText(body.heroImageUrl, 800),
    primary_color: normalizeClubColor(body.primaryColor),
    location_label: cleanClubText(body.locationLabel),
    contact_email: cleanClubText(body.contactEmail, 180).toLowerCase(),
    time_zone: cleanClubText(body.timeZone, 80) || 'America/Chicago',
    is_public: body.isPublic !== false,
  }
  if (payload.name.length < 2) return Response.json({ ok: false, message: 'Enter the club name.' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('clubs')
    .update(payload)
    .eq('id', clubId)
    .select('id,owner_user_id,name,slug,description,logo_url,hero_image_url,primary_color,location_label,contact_email,time_zone,is_public,created_at,updated_at')
    .single()

  if (error) return Response.json({ ok: false, message: 'Only club managers can update this club.' }, { status: 403 })
  return Response.json({ ok: true, club: mapClubRow(data as Record<string, unknown>) })
}
