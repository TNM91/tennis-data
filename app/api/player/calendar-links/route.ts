import { createCalendarFeedToken, hashCalendarFeedToken } from '@/lib/calendar-feed-tokens'
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

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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

  if (linkError) return Response.json({ ok: false, message: linkError.message }, { status: 500 })

  const coachLink = linkData as PlayerCoachCalendarLinkRow | null
  if (!coachLink?.id) {
    return Response.json({ ok: false, message: 'Coach link was not found for this player.' }, { status: 404 })
  }

  const token = createCalendarFeedToken()
  const tokenHash = hashCalendarFeedToken(token)
  const now = new Date().toISOString()

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
    return Response.json({ ok: false, message: insertError.message }, { status: 500 })
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
