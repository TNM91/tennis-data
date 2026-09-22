import { createClient } from '@supabase/supabase-js'
import { getClubApiAuth } from '@/lib/club-api-auth'
import {
  buildClubLogoStoragePath,
  CLUB_BRANDING_BUCKET,
  getManagedClubLogoPath,
  hasValidClubLogoSignature,
  validateClubLogoFile,
} from '@/lib/club-branding'
import { isClubManager, mapClubRow, normalizeClubRoles } from '@/lib/club-workspace'
import { supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

const clubSelect = 'id,owner_user_id,name,slug,description,logo_url,hero_image_url,primary_color,location_label,contact_email,time_zone,is_public,onboarding_completed_at,created_at,updated_at'

export async function POST(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params

  const membership = await auth.supabase
    .from('club_memberships')
    .select('roles,status')
    .eq('club_id', clubId)
    .eq('user_id', auth.userId)
    .eq('status', 'active')
    .maybeSingle()
  if (membership.error) return clubBrandingDatabaseError(membership.error.message)
  if (!membership.data || !isClubManager(normalizeClubRoles(membership.data.roles))) {
    return Response.json({ ok: false, message: 'Only club managers can update the club logo.' }, { status: 403 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ ok: false, message: 'The club logo could not be read.' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) return Response.json({ ok: false, message: 'Choose a club logo first.' }, { status: 400 })
  const validationMessage = validateClubLogoFile(file)
  if (validationMessage) return Response.json({ ok: false, message: validationMessage }, { status: 400 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!hasValidClubLogoSignature(bytes, file.type)) {
    return Response.json({ ok: false, message: 'That file does not appear to be a valid club logo image.' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return Response.json({ ok: false, message: 'Club logo uploads are not configured yet.' }, { status: 503 })
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const currentClub = await service.from('clubs').select('logo_url').eq('id', clubId).maybeSingle()
  if (currentClub.error || !currentClub.data) return clubBrandingDatabaseError(currentClub.error?.message || 'Club not found.')

  const storagePath = buildClubLogoStoragePath(clubId, file.type, crypto.randomUUID())
  const upload = await service.storage.from(CLUB_BRANDING_BUCKET).upload(storagePath, bytes, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  })
  if (upload.error) return clubBrandingDatabaseError(upload.error.message)

  const { data: publicFile } = service.storage.from(CLUB_BRANDING_BUCKET).getPublicUrl(storagePath)
  const update = await service
    .from('clubs')
    .update({ logo_url: publicFile.publicUrl })
    .eq('id', clubId)
    .select(clubSelect)
    .single()
  if (update.error) {
    await service.storage.from(CLUB_BRANDING_BUCKET).remove([storagePath])
    return clubBrandingDatabaseError(update.error.message)
  }

  const previousPath = getManagedClubLogoPath(String(currentClub.data.logo_url || ''), clubId)
  if (previousPath && previousPath !== storagePath) await service.storage.from(CLUB_BRANDING_BUCKET).remove([previousPath])

  return Response.json({ ok: true, club: mapClubRow(update.data as Record<string, unknown>), logoUrl: publicFile.publicUrl })
}

function clubBrandingDatabaseError(message: string) {
  const missingBucket = message.toLowerCase().includes(CLUB_BRANDING_BUCKET)
  return Response.json({
    ok: false,
    message: missingBucket
      ? 'Club logo upload is ready in the app, but its storage update has not been applied yet.'
      : 'The club logo could not be saved. Try again.',
  }, { status: 500 })
}
