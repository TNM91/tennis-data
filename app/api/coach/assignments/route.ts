import { getCoachApiAuth } from '@/lib/coach-api-auth'
import {
  buildCoachAssignmentReview,
  buildCoachAssignmentPayload,
  mapCoachAssignmentRow,
  type CoachAssignmentInput,
  type CoachAssignmentRow,
} from '@/lib/coach-storage'

export const runtime = 'nodejs'

type SaveAssignmentBody = {
  assignment?: CoachAssignmentInput
}

type ReviewAssignmentBody = {
  assignmentId?: unknown
  note?: unknown
  nextFocus?: unknown
}

export async function GET(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const studentLinkId = url.searchParams.get('studentLinkId')?.trim() ?? ''

  let query = auth.supabase
    .from('coach_assignments')
    .select('id,student_link_id,title,focus,due_date,status,assignment_json,updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)

  if (studentLinkId) {
    query = query.eq('student_link_id', studentLinkId)
  }

  const { data, error } = await query

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  const assignments = ((data ?? []) as CoachAssignmentRow[]).map(mapCoachAssignmentRow)
  return Response.json({ ok: true, assignments })
}

export async function POST(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  let body: SaveAssignmentBody
  try {
    body = (await request.json()) as SaveAssignmentBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid assignment request.' }, { status: 400 })
  }

  const payload = buildCoachAssignmentPayload(body.assignment ?? {}, auth.userId)
  if (!payload) {
    return Response.json({ ok: false, message: 'Student and assignment title are required.' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('coach_assignments')
    .upsert(payload, { onConflict: 'id' })
    .select('id,student_link_id,title,focus,due_date,status,assignment_json,updated_at')
    .single()

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, assignment: mapCoachAssignmentRow(data as CoachAssignmentRow) })
}

export async function PATCH(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  let body: ReviewAssignmentBody
  try {
    body = (await request.json()) as ReviewAssignmentBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid assignment review.' }, { status: 400 })
  }

  const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId.trim() : ''
  if (!assignmentId) {
    return Response.json({ ok: false, message: 'Assignment id is required.' }, { status: 400 })
  }

  const { data: existingData, error: existingError } = await auth.supabase
    .from('coach_assignments')
    .select('id,student_link_id,title,focus,due_date,status,assignment_json,updated_at')
    .eq('id', assignmentId)
    .maybeSingle()

  if (existingError) return Response.json({ ok: false, message: existingError.message }, { status: 500 })
  if (!existingData) return Response.json({ ok: false, message: 'Assignment was not found.' }, { status: 404 })

  const existing = mapCoachAssignmentRow(existingData as CoachAssignmentRow)
  const nextAssignmentJson = buildCoachAssignmentReview(existing.assignment, {
    note: body.note,
    nextFocus: body.nextFocus,
  })

  const { data, error } = await auth.supabase
    .from('coach_assignments')
    .update({ assignment_json: nextAssignmentJson, updated_at: new Date().toISOString() })
    .eq('id', assignmentId)
    .select('id,student_link_id,title,focus,due_date,status,assignment_json,updated_at')
    .single()

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, assignment: mapCoachAssignmentRow(data as CoachAssignmentRow) })
}

export async function DELETE(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const id = url.searchParams.get('id')?.trim() ?? ''
  if (!id) return Response.json({ ok: false, message: 'Missing assignment id.' }, { status: 400 })

  const { error } = await auth.supabase
    .from('coach_assignments')
    .delete()
    .eq('id', id)

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
