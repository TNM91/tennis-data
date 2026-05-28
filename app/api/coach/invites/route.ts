import { getCoachApiAuth } from '@/lib/coach-api-auth'
import {
  buildCoachInvitePayload,
  mapCoachInviteRow,
  type CoachStudentInviteInput,
  type CoachStudentInviteRow,
} from '@/lib/coach-invites'

export const runtime = 'nodejs'

type SaveInviteBody = {
  invite?: CoachStudentInviteInput
}

export async function GET(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('coach_student_invites')
    .select('id,student_link_id,invite_email,invite_token,status,message,expires_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  const origin = new URL(request.url).origin
  const invites = ((data ?? []) as CoachStudentInviteRow[]).map((row) => mapCoachInviteRow(row, origin))
  return Response.json({ ok: true, invites })
}

export async function POST(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  let body: SaveInviteBody
  try {
    body = (await request.json()) as SaveInviteBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid invite request.' }, { status: 400 })
  }

  const payload = buildCoachInvitePayload(body.invite ?? {}, auth.userId)
  const { data, error } = await auth.supabase
    .from('coach_student_invites')
    .insert(payload)
    .select('id,student_link_id,invite_email,invite_token,status,message,expires_at,updated_at')
    .single()

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, invite: mapCoachInviteRow(data as CoachStudentInviteRow, new URL(request.url).origin) })
}

export async function DELETE(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const id = url.searchParams.get('id')?.trim() ?? ''
  if (!id) return Response.json({ ok: false, message: 'Missing invite id.' }, { status: 400 })

  const { error } = await auth.supabase
    .from('coach_student_invites')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
