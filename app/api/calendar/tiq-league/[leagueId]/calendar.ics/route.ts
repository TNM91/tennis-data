import { createClient } from '@supabase/supabase-js'
import { buildScheduleCalendarFeed } from '@/lib/tiq-league-schedule-calendar'
import type { TiqLeagueScheduleItem } from '@/lib/tiq-league-schedule-service'

export const dynamic = 'force-dynamic'

const fallbackSupabaseUrl = 'https://pwxppfazbyourjrsutgx.supabase.co'
const fallbackSupabaseKey = 'sb_publishable_FQBYCnXJy2vjIYlri8TG7g_2XZ9IqqZ'

type TiqLeagueCalendarRow = {
  id?: string | null
  league_name?: string | null
  season_label?: string | null
  schedule_time_zone?: string | null
  is_public?: boolean | null
}

type TiqLeagueScheduleCalendarRow = {
  id?: string | null
  league_id?: string | null
  league_format?: string | null
  participant_a_name?: string | null
  participant_a_id?: string | null
  participant_b_name?: string | null
  participant_b_id?: string | null
  scheduled_date?: string | null
  scheduled_time?: string | null
  facility?: string | null
  status?: string | null
  notes?: string | null
  proposed_by_user_id?: string | null
  confirmed_by_user_id?: string | null
  created_at?: string | null
  updated_at?: string | null
}

function cleanText(value: unknown) {
  return String(value || '').trim()
}

function normalizeScheduleRow(row: TiqLeagueScheduleCalendarRow): TiqLeagueScheduleItem | null {
  const id = cleanText(row.id)
  const leagueId = cleanText(row.league_id)
  const scheduledDate = cleanText(row.scheduled_date)
  if (!id || !leagueId || !scheduledDate) return null

  return {
    id,
    leagueId,
    leagueFormat: cleanText(row.league_format).toLowerCase() === 'individual' ? 'individual' : 'team',
    participantAName: cleanText(row.participant_a_name),
    participantAId: cleanText(row.participant_a_id),
    participantBName: cleanText(row.participant_b_name),
    participantBId: cleanText(row.participant_b_id),
    scheduledDate,
    scheduledTime: cleanText(row.scheduled_time),
    facility: cleanText(row.facility),
    status: (
      ['confirmed', 'coordinator_set', 'completed', 'cancelled'].includes(cleanText(row.status).toLowerCase())
        ? cleanText(row.status).toLowerCase()
        : 'proposed'
    ) as TiqLeagueScheduleItem['status'],
    notes: cleanText(row.notes),
    proposedByUserId: cleanText(row.proposed_by_user_id),
    confirmedByUserId: cleanText(row.confirmed_by_user_id),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
  }
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

function getPublicSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || fallbackSupabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      fallbackSupabaseKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const { leagueId: rawLeagueId } = await params
  const leagueId = cleanText(decodeURIComponent(rawLeagueId || ''))
  if (!leagueId) return calendarResponse('League calendar id is required.', 400)

  try {
    const supabase = getPublicSupabaseClient()
    const leagueResult = await supabase
      .from('tiq_leagues')
      .select('id, league_name, season_label, schedule_time_zone, is_public')
      .eq('id', leagueId)
      .maybeSingle()

    if (leagueResult.error) throw leagueResult.error

    const league = leagueResult.data as TiqLeagueCalendarRow | null
    if (!league?.id || league.is_public === false) {
      return calendarResponse('League calendar not found.', 404)
    }

    const scheduleResult = await supabase
      .from('tiq_league_schedule_items')
      .select('id, league_id, league_format, participant_a_name, participant_a_id, participant_b_name, participant_b_id, scheduled_date, scheduled_time, facility, status, notes, proposed_by_user_id, confirmed_by_user_id, created_at, updated_at')
      .eq('league_id', leagueId)
      .neq('status', 'cancelled')
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })

    if (scheduleResult.error) throw scheduleResult.error

    const items = ((scheduleResult.data || []) as TiqLeagueScheduleCalendarRow[])
      .map(normalizeScheduleRow)
      .filter((item): item is TiqLeagueScheduleItem => Boolean(item))

    const calendarName = [
      cleanText(league.league_name) || 'TenAceIQ league',
      cleanText(league.season_label),
    ].filter(Boolean).join(' - ')
    const feed = buildScheduleCalendarFeed(items, {
      calendarName,
      productUrl: new URL(`/explore/leagues/tiq/${encodeURIComponent(leagueId)}?league_id=${encodeURIComponent(leagueId)}`, request.url).toString(),
      timeZone: cleanText(league.schedule_time_zone) || 'America/Chicago',
    })

    return calendarResponse(feed, 200, {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      'Content-Disposition': `inline; filename="tenaceiq-${leagueId}.ics"`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Calendar feed could not be generated.'
    return calendarResponse(message, 500)
  }
}
