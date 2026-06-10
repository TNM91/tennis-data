import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'
import {
  buildPlayerCalendarItemPayload,
  mapPlayerCalendarItemRow,
  type PlayerCalendarItemInput,
  type PlayerCalendarItemRow,
} from '@/lib/player-calendar-items'

export const runtime = 'nodejs'

const calendarItemSelect = 'id,player_user_id,title,scheduled_date,scheduled_time,location,kind,created_at,updated_at'

type SaveCalendarItemBody = {
  item?: PlayerCalendarItemInput
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('player_calendar_items')
    .select(calendarItemSelect)
    .eq('player_user_id', auth.userId)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })
    .limit(100)

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  return Response.json({
    ok: true,
    items: ((data ?? []) as PlayerCalendarItemRow[]).map(mapPlayerCalendarItemRow),
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

  const payload = buildPlayerCalendarItemPayload(body.item ?? {}, auth.userId)
  if (!payload) {
    return Response.json({ ok: false, message: 'Calendar title and date are required.' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('player_calendar_items')
    .upsert(payload, { onConflict: 'id' })
    .select(calendarItemSelect)
    .single()

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, item: mapPlayerCalendarItemRow(data as PlayerCalendarItemRow) })
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
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
