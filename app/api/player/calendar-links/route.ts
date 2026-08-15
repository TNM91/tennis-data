import { createCalendarFeedToken, hashCalendarFeedToken } from '@/lib/calendar-feed-tokens'
import { apiServerError } from '@/lib/api-error-response'
import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'

export const runtime = 'nodejs'

type CalendarLinkBody = {
  studentLinkId?: unknown
}

type PlayerCoachCalendarLinkRow = {
  id?: string | null
  coach_user_id?: string | null
  player_name?: string | null
}

type PlayerCoachCalendarFeedStatusRow = {
  scope_id?: string | null
  created_at?: string | null
  last_used_at?: string | null
  updated_at?: string | null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('calendar_feed_tokens')
    .select('scope_id, created_at, last_used_at, updated_at')
    .eq('scope_type', 'coach_student')
    .eq('owner_user_id', auth.userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return apiServerError('Could not load player coach calendar links', error, 'Calendar links are temporarily unavailable.')
  }

  const rows = (data ?? []) as PlayerCoachCalendarFeedStatusRow[]
  return Response.json({
    ok: true,
    feeds: rows
      .filter((row) => cleanText(row.scope_id))
      .map((row) => ({
        studentLinkId: cleanText(row.scope_id),
        createdAt: row.created_at ?? null,
        lastUsedAt: row.last_used_at ?? null,
        updatedAt: row.updated_at ?? null,
      })),
  })
}

export async function POST(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  let body: CalendarLinkBody
  try {
    body = (await request.json()) as CalendarLinkBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid calendar link request.' }, { status: 400 })
  }

  const studentLinkId = cleanText(body.studentLinkId)
  if (!studentLinkId) {
    return Response.json({ ok: false, message: 'Student link id is required.' }, { status: 400 })
  }

  const { data: linkData, error: linkError } = await auth.supabase
    .from('coach_player_links')
    .select('id, coach_user_id, player_name')
    .eq('id', studentLinkId)
    .eq('player_user_id', auth.userId)
    .maybeSingle()

  if (linkError) return apiServerError('Could not load player coach link', linkError, 'That coach calendar is temporarily unavailable.')

  const coachLink = linkData as PlayerCoachCalendarLinkRow | null
  if (!coachLink?.id) {
    return Response.json({ ok: false, message: 'Coach link was not found for this player.' }, { status: 404 })
  }

  const token = createCalendarFeedToken()
  const tokenHash = hashCalendarFeedToken(token)
  const now = new Date().toISOString()

  const { error: revokeError } = await auth.supabase
    .from('calendar_feed_tokens')
    .update({ status: 'revoked', updated_at: now })
    .eq('scope_type', 'coach_student')
    .eq('scope_id', studentLinkId)
    .eq('owner_user_id', auth.userId)
    .eq('status', 'active')

  if (revokeError) {
    return apiServerError('Could not refresh player coach calendar link', revokeError, 'The calendar link could not be refreshed.')
  }

  const { error: insertError } = await auth.supabase
    .from('calendar_feed_tokens')
    .insert({
      token_hash: tokenHash,
      scope_type: 'coach_student',
      scope_id: studentLinkId,
      owner_user_id: auth.userId,
      viewer_user_id: coachLink.coach_user_id,
      status: 'active',
      updated_at: now,
    })

  if (insertError) {
    return apiServerError('Could not create player coach calendar link', insertError, 'The calendar link could not be created.')
  }

  const calendarUrl = new URL(
    `/api/calendar/coach-student/${encodeURIComponent(studentLinkId)}/calendar.ics`,
    request.url,
  )
  calendarUrl.searchParams.set('token', token)

  return Response.json({
    ok: true,
    calendarUrl: calendarUrl.toString(),
    playerName: cleanText(coachLink.player_name) || 'Player',
  })
}

export async function DELETE(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const studentLinkId = cleanText(url.searchParams.get('studentLinkId'))
  if (!studentLinkId) {
    return Response.json({ ok: false, message: 'Student link id is required.' }, { status: 400 })
  }

  const { data: linkData, error: linkError } = await auth.supabase
    .from('coach_player_links')
    .select('id')
    .eq('id', studentLinkId)
    .eq('player_user_id', auth.userId)
    .maybeSingle()

  if (linkError) return apiServerError('Could not load player coach link', linkError, 'That coach calendar is temporarily unavailable.')

  const coachLink = linkData as PlayerCoachCalendarLinkRow | null
  if (!coachLink?.id) {
    return Response.json({ ok: false, message: 'Coach link was not found for this player.' }, { status: 404 })
  }

  const { error: revokeError } = await auth.supabase
    .from('calendar_feed_tokens')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('scope_type', 'coach_student')
    .eq('scope_id', studentLinkId)
    .eq('owner_user_id', auth.userId)
    .eq('status', 'active')

  if (revokeError) {
    return apiServerError('Could not revoke player coach calendar link', revokeError, 'The calendar link could not be revoked.')
  }

  return Response.json({ ok: true })
}
