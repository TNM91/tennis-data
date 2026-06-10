import { createCalendarFeedToken, hashCalendarFeedToken } from '@/lib/calendar-feed-tokens'
import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'

export const runtime = 'nodejs'

function buildPlayerCalendarUrl(request: Request, userId: string, token: string) {
  const calendarUrl = new URL(`/api/calendar/player/${encodeURIComponent(userId)}/calendar.ics`, request.url)
  calendarUrl.searchParams.set('token', token)
  return calendarUrl.toString()
}

type CalendarFeedStatusRow = {
  id?: string | null
  created_at?: string | null
  last_used_at?: string | null
  updated_at?: string | null
}

export async function GET(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('calendar_feed_tokens')
    .select('id, created_at, last_used_at, updated_at')
    .eq('scope_type', 'player_calendar')
    .eq('scope_id', auth.userId)
    .eq('owner_user_id', auth.userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  const activeFeed = data as CalendarFeedStatusRow | null
  return Response.json({
    ok: true,
    active: Boolean(activeFeed?.id),
    createdAt: activeFeed?.created_at ?? null,
    lastUsedAt: activeFeed?.last_used_at ?? null,
    updatedAt: activeFeed?.updated_at ?? null,
  })
}

export async function POST(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const token = createCalendarFeedToken()
  const tokenHash = hashCalendarFeedToken(token)
  const now = new Date().toISOString()

  const { error: revokeError } = await auth.supabase
    .from('calendar_feed_tokens')
    .update({ status: 'revoked', updated_at: now })
    .eq('scope_type', 'player_calendar')
    .eq('scope_id', auth.userId)
    .eq('owner_user_id', auth.userId)
    .eq('status', 'active')

  if (revokeError) {
    return Response.json({ ok: false, message: revokeError.message }, { status: 500 })
  }

  const { error: insertError } = await auth.supabase
    .from('calendar_feed_tokens')
    .insert({
      token_hash: tokenHash,
      scope_type: 'player_calendar',
      scope_id: auth.userId,
      owner_user_id: auth.userId,
      viewer_user_id: null,
      status: 'active',
      updated_at: now,
    })

  if (insertError) {
    return Response.json({ ok: false, message: insertError.message }, { status: 500 })
  }

  return Response.json({
    ok: true,
    calendarUrl: buildPlayerCalendarUrl(request, auth.userId, token),
  })
}

export async function DELETE(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const { error: revokeError } = await auth.supabase
    .from('calendar_feed_tokens')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('scope_type', 'player_calendar')
    .eq('scope_id', auth.userId)
    .eq('owner_user_id', auth.userId)
    .eq('status', 'active')

  if (revokeError) {
    return Response.json({ ok: false, message: revokeError.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
