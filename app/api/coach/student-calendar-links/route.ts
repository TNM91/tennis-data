import { createCalendarFeedToken, hashCalendarFeedToken } from '@/lib/calendar-feed-tokens'
import { getCoachApiAuth } from '@/lib/coach-api-auth'

export const runtime = 'nodejs'

type CalendarLinkBody = {
  studentLinkId?: unknown
}

type CoachStudentCalendarLinkRow = {
  id?: string | null
  player_name?: string | null
  player_user_id?: string | null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  const auth = await getCoachApiAuth(request)
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

  const { data: studentData, error: studentError } = await auth.supabase
    .from('coach_player_links')
    .select('id, player_name, player_user_id')
    .eq('id', studentLinkId)
    .eq('coach_user_id', auth.userId)
    .maybeSingle()

  if (studentError) return Response.json({ ok: false, message: studentError.message }, { status: 500 })

  const student = studentData as CoachStudentCalendarLinkRow | null
  if (!student?.id) {
    return Response.json({ ok: false, message: 'Student link was not found.' }, { status: 404 })
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
    return Response.json({ ok: false, message: revokeError.message }, { status: 500 })
  }

  const { error: insertError } = await auth.supabase
    .from('calendar_feed_tokens')
    .insert({
      token_hash: tokenHash,
      scope_type: 'coach_student',
      scope_id: studentLinkId,
      owner_user_id: auth.userId,
      viewer_user_id: student.player_user_id,
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
    studentName: cleanText(student.player_name) || 'Student',
  })
}

export async function DELETE(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const studentLinkId = cleanText(url.searchParams.get('studentLinkId'))
  if (!studentLinkId) {
    return Response.json({ ok: false, message: 'Student link id is required.' }, { status: 400 })
  }

  const { data: studentData, error: studentError } = await auth.supabase
    .from('coach_player_links')
    .select('id')
    .eq('id', studentLinkId)
    .eq('coach_user_id', auth.userId)
    .maybeSingle()

  if (studentError) return Response.json({ ok: false, message: studentError.message }, { status: 500 })

  const student = studentData as CoachStudentCalendarLinkRow | null
  if (!student?.id) {
    return Response.json({ ok: false, message: 'Student link was not found.' }, { status: 404 })
  }

  const { error: revokeError } = await auth.supabase
    .from('calendar_feed_tokens')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('scope_type', 'coach_student')
    .eq('scope_id', studentLinkId)
    .eq('owner_user_id', auth.userId)
    .eq('status', 'active')

  if (revokeError) {
    return Response.json({ ok: false, message: revokeError.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
