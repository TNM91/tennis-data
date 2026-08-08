import { createClient } from '@supabase/supabase-js'
import { cleanClubText } from '@/lib/club-workspace'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

function createPublicClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const { data, error } = await createPublicClient().rpc('get_club_group_renewal_preview', { target_response_token: token })
  const row = Array.isArray(data) ? data[0] as Record<string, unknown> | undefined : undefined
  if (error || !row) return Response.json({ ok: false, message: 'This renewal link is unavailable.' }, { status: 404 })

  return Response.json({
    ok: true,
    renewal: {
      clubName: cleanClubText(row.club_name),
      clubSlug: cleanClubText(row.club_slug),
      clubLogoUrl: cleanClubText(row.club_logo_url, 800),
      groupName: cleanClubText(row.group_name),
      groupType: cleanClubText(row.group_type),
      seasonLabel: cleanClubText(row.season_label),
      playerName: cleanClubText(row.player_name),
      status: cleanClubText(row.renewal_status),
      expiresAt: cleanClubText(row.expires_at, 80),
      expired: Boolean(row.expires_at && new Date(String(row.expires_at)).getTime() <= Date.now()),
    },
  })
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const body = await request.json().catch(() => ({})) as { status?: unknown }
  const status = cleanClubText(body.status)
  if (status !== 'confirmed' && status !== 'declined') {
    return Response.json({ ok: false, message: 'Choose yes or no.' }, { status: 400 })
  }

  const { data, error } = await createPublicClient().rpc('respond_club_group_renewal', {
    target_response_token: token,
    target_status: status,
  })
  if (error) return Response.json({ ok: false, message: error.message }, { status: 400 })
  return Response.json({
    ok: true,
    status: cleanClubText(data) || status,
    message: status === 'confirmed' ? 'You are confirmed for the new season.' : 'Your club knows you are not returning this season.',
  })
}
