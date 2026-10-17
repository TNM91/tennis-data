import { apiServerError } from '@/lib/api-error-response'
import {
  buildPlayerReflectionPayload,
  mapPlayerReflectionRow,
  type PlayerReflectionInput,
  type PlayerReflectionRow,
} from '@/lib/player-reflections'
import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'

export const runtime = 'nodejs'

const reflectionSelect =
  'id,player_user_id,player_id,outcome,worked,next_step,proof_label,result_label,created_at,updated_at'

type SaveReflectionBody = {
  reflection?: PlayerReflectionInput
}

export async function GET(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('player_reflections')
    .select(reflectionSelect)
    .eq('player_user_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return apiServerError('Could not load player reflections', error, 'Your reflection history is temporarily unavailable.')

  return Response.json({
    ok: true,
    reflections: ((data ?? []) as PlayerReflectionRow[]).map(mapPlayerReflectionRow),
  })
}

export async function POST(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  let body: SaveReflectionBody
  try {
    body = (await request.json()) as SaveReflectionBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid reflection.' }, { status: 400 })
  }

  const payload = buildPlayerReflectionPayload(body.reflection ?? {}, auth.userId)
  if (!payload) {
    return Response.json({ ok: false, message: 'Choose how it went and add one honest read.' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('player_reflections')
    .upsert(payload, { onConflict: 'id' })
    .select(reflectionSelect)
    .single()

  if (error) return apiServerError('Could not save player reflection', error, 'Your reflection could not sync yet.')

  return Response.json({ ok: true, reflection: mapPlayerReflectionRow(data as PlayerReflectionRow) })
}
