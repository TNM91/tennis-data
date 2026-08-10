import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'
import { loadPlayerCompetitionSchedule } from '@/lib/player-competition-schedule'

export const runtime = 'nodejs'

type ScheduleResponseBody = {
  eventId?: unknown
  response?: unknown
}

type CompetitionOwnerRow = {
  created_by_user_id?: string | null
}

type EntryNameRow = {
  player_name?: string | null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

export async function POST(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  let body: ScheduleResponseBody
  try {
    body = (await request.json()) as ScheduleResponseBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid schedule response.' }, { status: 400 })
  }

  const eventId = cleanText(body.eventId)
  const response = body.response === 'available' || body.response === 'unavailable' ? body.response : ''
  if (!eventId || !response) {
    return Response.json({ ok: false, message: 'Choose Available or Can’t play.' }, { status: 400 })
  }

  try {
    const events = await loadPlayerCompetitionSchedule(auth.supabase, auth.userId)
    const event = events.find((item) => item.id === eventId)
    if (!event) {
      return Response.json({ ok: false, message: 'This competition event is no longer available.' }, { status: 404 })
    }

    const snapshot = {
      title: event.title,
      date: event.date,
      time: event.time,
      location: event.location,
    }
    const now = new Date().toISOString()
    const { data, error } = await auth.supabase
      .from('player_schedule_responses')
      .upsert({
        player_user_id: auth.userId,
        competition_kind: event.kind,
        competition_id: event.competitionId,
        event_id: event.id,
        response,
        event_snapshot: snapshot,
        updated_at: now,
      }, { onConflict: 'player_user_id,competition_kind,competition_id,event_id' })
      .select('id,response,event_snapshot,updated_at')
      .single()

    if (error) throw error

    const [ownerResult, entryResult] = await Promise.all([
      auth.supabase
        .from(event.kind === 'league' ? 'tiq_leagues' : 'tiq_tournaments')
        .select('created_by_user_id')
        .eq('id', event.competitionId)
        .maybeSingle(),
      auth.supabase
        .from(event.kind === 'league' ? 'tiq_player_league_entries' : 'tiq_tournament_entries')
        .select('player_name')
        .eq(event.kind === 'league' ? 'league_id' : 'tournament_id', event.competitionId)
        .eq(event.kind === 'league' ? 'created_by_user_id' : 'submitted_by_user_id', auth.userId)
        .maybeSingle(),
    ])

    const organizerId = cleanText((ownerResult.data as CompetitionOwnerRow | null)?.created_by_user_id)
    const playerName = cleanText((entryResult.data as EntryNameRow | null)?.player_name) || 'A player'
    if (organizerId && organizerId !== auth.userId) {
      await auth.supabase.from('internal_notifications').insert({
        recipient_profile_id: organizerId,
        actor_user_id: auth.userId,
        notification_type: 'schedule',
        title: response === 'available' ? `${playerName} is available` : `${playerName} can’t play`,
        body: `${event.title} · ${event.date}${event.time ? ` at ${event.time}` : ''}`,
        href: event.kind === 'league'
          ? `/league-coordinator#league-registry`
          : `/league-coordinator/tournaments#tournament-builder`,
      })
    }

    return Response.json({
      ok: true,
      item: {
        id: cleanText((data as { id?: string | null } | null)?.id),
        eventId: event.id,
        response,
        updatedAt: cleanText((data as { updated_at?: string | null } | null)?.updated_at) || now,
      },
    })
  } catch (error) {
    return Response.json({
      ok: false,
      message: error instanceof Error ? error.message : 'Schedule response could not be saved.',
    }, { status: 500 })
  }
}
