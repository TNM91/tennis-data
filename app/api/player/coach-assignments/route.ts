import { createClient } from '@supabase/supabase-js'
import { apiServerError } from '@/lib/api-error-response'
import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'
import {
  buildPlayerAssignmentCompletion,
  mapCoachAssignmentRow,
  mapCoachStudentLinkRow,
  type CoachAssignmentRow,
  type CoachStudentLinkRow,
} from '@/lib/coach-storage'
import { supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

const coachLinkSelect = 'id,coach_user_id,player_user_id,player_id,player_name,identity_slug,level_label,player_email,player_phone,contact_preference,setup_status,status,notes,updated_at'

export async function GET(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const { data: linkData, error: linkError } = await auth.supabase
    .from('coach_player_links')
    .select(coachLinkSelect)
    .eq('player_user_id', auth.userId)
    .order('updated_at', { ascending: false })
    .limit(20)

  if (linkError) {
    return apiServerError('Could not load player coach connections', linkError, 'Coach assignments are temporarily unavailable.')
  }

  const coachLinks = ((linkData ?? []) as CoachStudentLinkRow[]).map(mapCoachStudentLinkRow)
  const linkIds = coachLinks.map((link) => link.id)

  if (!linkIds.length) {
    return Response.json({ ok: true, coachLinks, assignments: [] })
  }

  const { data: assignmentData, error: assignmentError } = await auth.supabase
    .from('coach_assignments')
    .select('id,student_link_id,title,focus,due_date,status,assignment_json,updated_at')
    .in('student_link_id', linkIds)
    .in('status', ['assigned', 'completed'])
    .order('updated_at', { ascending: false })
    .limit(100)

  if (assignmentError) {
    return apiServerError('Could not load player coach assignments', assignmentError, 'Coach assignments are temporarily unavailable.')
  }

  const assignments = ((assignmentData ?? []) as CoachAssignmentRow[]).map(mapCoachAssignmentRow)
  return Response.json({ ok: true, coachLinks, assignments })
}

export async function PATCH(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  let body: { assignmentId?: unknown; recap?: unknown; evidence?: unknown; expectedUpdatedAt?: unknown }
  try {
    const value: unknown = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) return Response.json({ ok: false, message: 'Invalid assignment check-in.' }, { status: 400 })
    body = value as typeof body
  } catch {
    return Response.json({ ok: false, message: 'Invalid assignment check-in.' }, { status: 400 })
  }

  const guarded = body.expectedUpdatedAt !== undefined
  if (guarded && (typeof body.expectedUpdatedAt !== 'string' || body.expectedUpdatedAt.length > 80 || !Number.isFinite(Date.parse(body.expectedUpdatedAt)) || typeof body.recap !== 'string' || body.recap.length > 700 || typeof body.evidence !== 'string' || body.evidence.length > 300)) return Response.json({ ok: false, message: 'Refresh this assignment and keep your recap under 700 characters and proof under 300.' }, { status: 400 })
  const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId.trim() : ''
  if (!assignmentId) {
    return Response.json({ ok: false, message: 'Assignment id is required.' }, { status: 400 })
  }

  const { data: existingData, error: existingError } = await auth.supabase
    .from('coach_assignments')
    .select('id,student_link_id,title,focus,due_date,status,assignment_json,updated_at')
    .eq('id', assignmentId)
    .maybeSingle()

  if (existingError) return apiServerError('Could not load player coach assignment', existingError, 'That coach assignment is temporarily unavailable.')
  if (!existingData) return Response.json({ ok: false, message: 'Assignment was not found for this player.' }, { status: 404 })

  const existing = mapCoachAssignmentRow(existingData as CoachAssignmentRow)
  if (existing.status === 'archived') {
    return Response.json({ ok: false, message: 'Archived assignments cannot be completed.' }, { status: 409 })
  }

  const { data: linkData, error: linkError } = await auth.supabase
    .from('coach_player_links')
    .select('id')
    .eq('id', existing.studentLinkId)
    .eq('player_user_id', auth.userId)
    .maybeSingle()

  if (linkError) return apiServerError('Could not verify player coach connection', linkError, 'That coach assignment is temporarily unavailable.')
  if (!linkData) {
    return Response.json({ ok: false, message: 'Assignment was not found for this player.' }, { status: 404 })
  }

  if (guarded && (existingData.updated_at !== body.expectedUpdatedAt || existing.status !== 'assigned' || existing.assignment.playerCheckIn)) return Response.json({ ok: false, code: 'assignment_conflict', message: 'This assignment changed. Refresh before sending your check-in.' }, { status: 409 })

  const service = getServiceClient()
  if (!service) {
    return Response.json({ ok: false, message: 'Coach assignment check-ins are not configured yet.' }, { status: 503 })
  }

  const nextAssignmentJson = buildPlayerAssignmentCompletion(existing.assignment, {
    recap: body.recap,
    evidence: body.evidence,
  })

  let update = service
    .from('coach_assignments')
    .update({
      status: 'completed',
      assignment_json: nextAssignmentJson,
      updated_at: new Date(Math.max(Date.now(), Date.parse(existingData.updated_at) + 1)).toISOString(),
    })
    .eq('id', assignmentId)
    .eq('student_link_id', existing.studentLinkId)
  if (guarded) update = update.eq('updated_at', body.expectedUpdatedAt as string).eq('status', 'assigned')
  const { data: updatedData, error: updateError } = await update.select('id,student_link_id,title,focus,due_date,status,assignment_json,updated_at').maybeSingle()

  if (updateError) return apiServerError('Could not update player coach assignment', updateError, 'The coach assignment could not be updated.')

  if (!updatedData) return Response.json({ ok: false, code: 'assignment_conflict', message: 'The assignment changed while saving. Refresh before trying again.' }, { status: 409 })
  return Response.json({ ok: true, assignment: mapCoachAssignmentRow(updatedData as CoachAssignmentRow) })
}

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return null
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
