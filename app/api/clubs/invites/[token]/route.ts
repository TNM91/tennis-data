import { createClient } from '@supabase/supabase-js'
import { getClubApiAuth } from '@/lib/club-api-auth'
import { cleanClubText, normalizeClubRoles } from '@/lib/club-workspace'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await supabase.rpc('get_club_invite_preview', { target_invite_token: token })
  const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined
  if (error || !row) return Response.json({ ok: false, message: 'Club invitation not found.' }, { status: 404 })

  return Response.json({
    ok: true,
    invite: {
      clubName: cleanClubText(row.club_name),
      clubSlug: cleanClubText(row.club_slug),
      clubLogoUrl: cleanClubText(row.club_logo_url, 800),
      email: cleanClubText(row.invite_email, 180),
      roles: normalizeClubRoles(row.invite_roles),
      status: cleanClubText(row.invite_status),
      expiresAt: cleanClubText(row.expires_at, 80),
    },
  })
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { token } = await context.params

  const { data, error } = await auth.supabase.rpc('accept_club_invite', { target_invite_token: token })
  if (error) return Response.json({ ok: false, message: error.message }, { status: 400 })
  return Response.json({ ok: true, clubId: cleanClubText(data) })
}
