import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'
import { apiServerError } from '@/lib/api-error-response'
import {
  buildPlayerCalendarItemPayload,
  mapPlayerCalendarItemRow,
  type PlayerCalendarItemInput,
  type PlayerCalendarItemRow,
} from '@/lib/player-calendar-items'
import { loadPlayerCompetitionSchedule } from '@/lib/player-competition-schedule'

export const runtime = 'nodejs'

const calendarItemSelect = 'id,player_user_id,title,scheduled_date,scheduled_time,location,kind,recurrence_rule,availability_status,created_at,updated_at'

type SaveCalendarItemBody = {
  item?: PlayerCalendarItemInput
  items?: PlayerCalendarItemInput[]
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const [personalResult, competitionResult] = await Promise.all([
    auth.supabase
      .from('player_calendar_items')
      .select(calendarItemSelect)
      .eq('player_user_id', auth.userId)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })
      .limit(100),
    loadPlayerCompetitionSchedule(auth.supabase, auth.userId)
      .then((items) => ({ items, error: null }))
      .catch((error: unknown) => ({
        items: [],
        error: error instanceof Error ? error : new Error('Competition dates could not be loaded.'),
      })),
  ])

  if (personalResult.error) {
    return Response.json({ ok: false, message: personalResult.error.message }, { status: 500 })
  }

  return Response.json({
    ok: true,
    items: ((personalResult.data ?? []) as PlayerCalendarItemRow[]).map(mapPlayerCalendarItemRow),
    competitionItems: competitionResult.items,
    competitionWarning: competitionResult.error?.message ?? '',
  })
}

export async function POST(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  let body: SaveCalendarItemBody
  try {
    body = (await request.json()) as SaveCalendarItemBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid calendar item request.' }, { status: 400 })
  }

  const requestedItems = Array.isArray(body.items)
    ? body.items.slice(0, 100)
    : body.item
      ? [body.item]
      : []
  const payloads = requestedItems
    .map((item) => buildPlayerCalendarItemPayload(item, auth.userId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  if (!payloads.length) {
    return Response.json({ ok: false, message: 'Each calendar item needs a title and date.' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('player_calendar_items')
    .upsert(payloads, { onConflict: 'id' })
    .select(calendarItemSelect)

  if (error) {
    return apiServerError('Could not save player calendar item', error, 'The calendar item could not be saved.')
  }

  const items = ((data ?? []) as PlayerCalendarItemRow[]).map(mapPlayerCalendarItemRow)

  return Response.json({
    ok: true,
    item: items[0] ?? null,
    items,
    savedCount: payloads.length,
    skippedCount: requestedItems.length - payloads.length,
  })
}

export async function DELETE(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const id = cleanText(new URL(request.url).searchParams.get('id'))
  if (!id) return Response.json({ ok: false, message: 'Calendar item id is required.' }, { status: 400 })

  const { error } = await auth.supabase
    .from('player_calendar_items')
    .delete()
    .eq('id', id)
    .eq('player_user_id', auth.userId)

  if (error) {
    return apiServerError('Could not delete player calendar item', error, 'The calendar item could not be deleted.')
  }

  return Response.json({ ok: true })
}
