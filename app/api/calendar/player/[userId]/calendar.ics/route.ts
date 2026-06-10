import { createClient } from '@supabase/supabase-js'
import { hashCalendarFeedToken } from '@/lib/calendar-feed-tokens'
import { buildCoachStudentCalendarEvents } from '@/lib/coach-calendar'
import {
  mapCoachAssignmentRow,
  mapCoachStudentLinkRow,
  type CoachAssignmentRow,
  type CoachStudentLink,
  type CoachStudentLinkRow,
} from '@/lib/coach-storage'
import {
  mapPlayerCalendarItemRow,
  type PlayerCalendarItem,
  type PlayerCalendarItemRow,
} from '@/lib/player-calendar-items'
import { buildTennisCalendarFeed, type TennisCalendarEvent } from '@/lib/tiq-league-schedule-calendar'
import { supabaseUrl } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const playerCalendarSelect = 'id,player_user_id,title,scheduled_date,scheduled_time,kind,created_at,updated_at'
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

function buildPlayerItemEvent(item: PlayerCalendarItem, request: Request): TennisCalendarEvent {
  return {
    id: `player-calendar-${item.id}`,
    title: item.title,
    date: item.date,
    time: item.time,
    description: [`My calendar: ${item.kind}`, item.time ? `Time: ${item.time}` : 'All day'].join('\n'),
    url: new URL('/mylab#my-calendar', request.url).toString(),
    durationMinutes: item.time ? 60 : undefined,
  }
}

function absolutizePlayerFeedEvents(events: TennisCalendarEvent[], request: Request) {
  return events.map((event) => ({
    ...event,
    url: new URL(event.url && !event.url.startsWith('/coach') ? event.url : '/mylab#coach-assignments', request.url).toString(),
  }))
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId: rawUserId } = await params
  const userId = cleanText(decodeURIComponent(rawUserId || ''))
  const token = cleanText(new URL(request.url).searchParams.get('token'))

  if (!userId || !token) {
    return calendarResponse('Player calendar token is required.', 401)
  }

  const supabase = getServiceClient()
  if (!supabase) {
    return calendarResponse('Player calendar feeds are not configured.', 503)
  }

  try {
    const tokenHash = hashCalendarFeedToken(token)
    const { data: tokenData, error: tokenError } = await supabase
      .from('calendar_feed_tokens')
      .select('id, scope_id, status')
      .eq('scope_type', 'player_calendar')
      .eq('scope_id', userId)
      .eq('token_hash', tokenHash)
      .eq('status', 'active')
      .maybeSingle()

    if (tokenError) throw tokenError

    const feedToken = tokenData as CalendarFeedTokenRow | null
    if (!feedToken?.id || feedToken.scope_id !== userId) {
      return calendarResponse('Player calendar not found.', 404)
    }

    const { data: personalData, error: personalError } = await supabase
      .from('player_calendar_items')
      .select(playerCalendarSelect)
      .eq('player_user_id', userId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })
      .limit(100)

    if (personalError) throw personalError

    const { data: linkData, error: linkError } = await supabase
      .from('coach_player_links')
      .select(coachStudentSelect)
      .eq('player_user_id', userId)
      .eq('status', 'active')
      .limit(25)

    if (linkError) throw linkError

    const coachLinks = ((linkData ?? []) as CoachStudentLinkRow[]).map(mapCoachStudentLinkRow)
    const linkIds = coachLinks.map((link) => link.id).filter(Boolean)
    let assignmentsByLinkId = new Map<string, CoachAssignmentRow[]>()

    if (linkIds.length) {
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('coach_assignments')
        .select(assignmentSelect)
        .in('student_link_id', linkIds)
        .in('status', ['assigned', 'completed'])
        .order('due_date', { ascending: true })
        .order('updated_at', { ascending: false })
        .limit(200)

      if (assignmentError) throw assignmentError

      assignmentsByLinkId = ((assignmentData ?? []) as CoachAssignmentRow[]).reduce((map, assignment) => {
        map.set(assignment.student_link_id, [...(map.get(assignment.student_link_id) ?? []), assignment])
        return map
      }, new Map<string, CoachAssignmentRow[]>())
    }

    const personalEvents = ((personalData ?? []) as PlayerCalendarItemRow[])
      .map(mapPlayerCalendarItemRow)
      .map((item) => buildPlayerItemEvent(item, request))

    const coachEvents = coachLinks.flatMap((link: CoachStudentLink) =>
      absolutizePlayerFeedEvents(
        buildCoachStudentCalendarEvents(
          (assignmentsByLinkId.get(link.id) ?? []).map(mapCoachAssignmentRow),
          link,
        ),
        request,
      ),
    )

    const feed = buildTennisCalendarFeed([...personalEvents, ...coachEvents], {
      calendarName: 'TenAceIQ My Calendar',
      productUrl: new URL('/mylab#my-calendar', request.url).toString(),
      timeZone: 'America/Chicago',
    })

    await supabase
      .from('calendar_feed_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', feedToken.id)

    return calendarResponse(feed, 200, {
      'Cache-Control': 'private, max-age=120',
      'Content-Disposition': 'inline; filename="tenaceiq-my-calendar.ics"',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Player calendar feed could not be generated.'
    return calendarResponse(message, 500)
  }
}
