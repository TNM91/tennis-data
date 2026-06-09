import { createClient } from '@supabase/supabase-js'
import { hashCalendarFeedToken } from '@/lib/calendar-feed-tokens'
import { buildCoachStudentCalendarEvents } from '@/lib/coach-calendar'
import {
  mapCoachAssignmentRow,
  mapCoachStudentLinkRow,
  type CoachAssignmentRow,
  type CoachStudentLinkRow,
} from '@/lib/coach-storage'
import { buildTennisCalendarFeed } from '@/lib/tiq-league-schedule-calendar'
import { supabaseUrl } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const coachStudentSelect = 'id,coach_user_id,player_user_id,player_id,player_name,identity_slug,level_label,player_email,player_phone,contact_preference,setup_status,status,notes,updated_at'
const assignmentSelect = 'id,student_link_id,title,focus,due_date,status,assignment_json,updated_at'

type CalendarFeedTokenRow = {
  id?: string | null
  scope_id?: string | null
  status?: string | null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function calendarResponse(body: string, status = 200, headers: HeadersInit = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': status === 200 ? 'text/calendar; charset=utf-8' : 'text/plain; charset=utf-8',
      ...headers,
    },
  })
}

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return null

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function absolutizeEventUrls<T extends { url?: string }>(events: T[], request: Request) {
  return events.map((event) => ({
    ...event,
    url: event.url ? new URL(event.url, request.url).toString() : new URL('/mylab#coach-assignments', request.url).toString(),
  }))
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentLinkId: string }> },
) {
  const { studentLinkId: rawStudentLinkId } = await params
  const studentLinkId = cleanText(decodeURIComponent(rawStudentLinkId || ''))
  const token = cleanText(new URL(request.url).searchParams.get('token'))

  if (!studentLinkId || !token) {
    return calendarResponse('Coach/student calendar token is required.', 401)
  }

  const supabase = getServiceClient()
  if (!supabase) {
    return calendarResponse('Coach/student calendar feeds are not configured.', 503)
  }

  try {
    const tokenHash = hashCalendarFeedToken(token)
    const { data: tokenData, error: tokenError } = await supabase
      .from('calendar_feed_tokens')
      .select('id, scope_id, status')
      .eq('scope_type', 'coach_student')
      .eq('scope_id', studentLinkId)
      .eq('token_hash', tokenHash)
      .eq('status', 'active')
      .maybeSingle()

    if (tokenError) throw tokenError

    const feedToken = tokenData as CalendarFeedTokenRow | null
    if (!feedToken?.id || feedToken.scope_id !== studentLinkId) {
      return calendarResponse('Coach/student calendar not found.', 404)
    }

    const { data: studentData, error: studentError } = await supabase
      .from('coach_player_links')
      .select(coachStudentSelect)
      .eq('id', studentLinkId)
      .maybeSingle()

    if (studentError) throw studentError
    if (!studentData) return calendarResponse('Coach/student calendar not found.', 404)

    const student = mapCoachStudentLinkRow(studentData as CoachStudentLinkRow)
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('coach_assignments')
      .select(assignmentSelect)
      .eq('student_link_id', studentLinkId)
      .in('status', ['assigned', 'completed'])
      .order('due_date', { ascending: true })
      .order('updated_at', { ascending: false })
      .limit(100)

    if (assignmentError) throw assignmentError

    const assignments = ((assignmentData ?? []) as CoachAssignmentRow[]).map(mapCoachAssignmentRow)
    const events = absolutizeEventUrls(buildCoachStudentCalendarEvents(assignments, student), request)
    const feed = buildTennisCalendarFeed(events, {
      calendarName: `${student.playerName || 'Student'} coach lessons`,
      productUrl: new URL('/mylab#coach-assignments', request.url).toString(),
      timeZone: 'America/Chicago',
    })

    await supabase
      .from('calendar_feed_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', feedToken.id)

    return calendarResponse(feed, 200, {
      'Cache-Control': 'private, max-age=120',
      'Content-Disposition': `inline; filename="tenaceiq-coach-${studentLinkId}.ics"`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Coach/student calendar feed could not be generated.'
    return calendarResponse(message, 500)
  }
}
