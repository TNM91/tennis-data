import { getCoachApiAuth } from '@/lib/coach-api-auth'
import {
  buildCoachStudentLinkPayload,
  mapCoachStudentLinkRow,
  type CoachStudentLinkInput,
  type CoachStudentLinkRow,
} from '@/lib/coach-storage'

export const runtime = 'nodejs'

const studentSelect = 'id,coach_user_id,player_user_id,player_id,player_name,identity_slug,level_label,player_email,player_phone,contact_preference,setup_status,status,notes,updated_at'

type SaveStudentBody = {
  student?: CoachStudentLinkInput
}

export async function GET(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('coach_player_links')
    .select(studentSelect)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  const students = ((data ?? []) as CoachStudentLinkRow[]).map(mapCoachStudentLinkRow)
  return Response.json({ ok: true, students })
}

export async function POST(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  let body: SaveStudentBody
  try {
    body = (await request.json()) as SaveStudentBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid student request.' }, { status: 400 })
  }

  const payload = buildCoachStudentLinkPayload(body.student ?? {}, auth.userId)
  if (!payload) {
    return Response.json({ ok: false, message: 'Player name is required.' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('coach_player_links')
    .upsert(payload, { onConflict: 'id' })
    .select(studentSelect)
    .single()

  if (error) {
    return Response.json({ ok: false, message: buildCoachStudentSaveErrorMessage(error.message) }, { status: 500 })
  }

  return Response.json({ ok: true, student: mapCoachStudentLinkRow(data as CoachStudentLinkRow) })
}

function buildCoachStudentSaveErrorMessage(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes('pattern') || lower.includes('phone')) {
    return 'Student record failed: the saved phone format was rejected. Try a 10-digit US cell number like 6365778790, or +16365778790.'
  }
  if (lower.includes('uuid')) {
    return 'Student record failed: the saved identifier format was rejected. Refresh Coach Hub and try Save again.'
  }
  return `Student record failed: ${message}`
}

export async function DELETE(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const id = url.searchParams.get('id')?.trim() ?? ''
  if (!id) return Response.json({ ok: false, message: 'Missing student id.' }, { status: 400 })

  const { error } = await auth.supabase
    .from('coach_player_links')
    .delete()
    .eq('id', id)

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
