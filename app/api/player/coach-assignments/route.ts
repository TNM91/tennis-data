import { createClient } from '@supabase/supabase-js'
import { getPlayerApiAuth } from '@/lib/player-api-auth'
import {
  buildPlayerAssignmentCompletion,
  mapCoachAssignmentRow,
  mapCoachStudentLinkRow,
  type CoachAssignmentRow,
  type CoachStudentLinkRow,
} from '@/lib/coach-storage'
import { supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await getPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const { data: linkData, error: linkError } = await auth.supabase
    .from('coach_player_links')
    .select('id,coach_user_id,player_user_id,player_id,player_name,identity_slug,level_label,status,notes,updated_at')
    .eq('player_user_id', auth.userId)
    .order('updated_at', { ascending: false })
    .limit(20)

  if (linkError) {
    return Response.json({ ok: false, message: linkError.message }, { status: 500 })
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
    return Response.json({ ok: false, message: assignmentError.message }, { status: 500 })
  }

  const assignments = ((assignmentData ?? []) as CoachAssignmentRow[]).map(mapCoachAssignmentRow)
  return Response.json({ ok: true, coachLinks, assignments })
}

export async function PATCH(request: Request) {
  const auth = await getPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  let body: { assignmentId?: unknown; recap?: unknown; evidence?: unknown }
  try {
    body = (await request.json()) as { assignmentId?: unknown; recap?: unknown; evidence?: unknown }
  } catch {
    return Response.json({ ok: false, message: 'Invalid assignment check-in.' }, { status: 400 })
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
  if (!existingData) return Response.json({ ok: false, message: 'Assignment was not found for this player.' }, { status: 404 })

  const existing = mapCoachAssignmentRow(existingData as CoachAssignmentRow)
  if (existing.status === 'archived') {
    return Response.json({ ok: false, message: 'Archived assignments cannot be completed.' }, { status: 409 })
  }

  const service = getServiceClient()
  if (!service) {
    return Response.json({ ok: false, message: 'Coach assignment check-ins are not configured yet.' }, { status: 503 })
  }

  const nextAssignmentJson = buildPlayerAssignmentCompletion(existing.assignment, {
    recap: body.recap,
    evidence: body.evidence,
  })

  const { data: updatedData, error: updateError } = await service
    .from('coach_assignments')
    .update({
      status: 'completed',
      assignment_json: nextAssignmentJson,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
    .select('id,student_link_id,title,focus,due_date,status,assignment_json,updated_at')
    .single()

  if (updateError) return Response.json({ ok: false, message: updateError.message }, { status: 500 })

  return Response.json({ ok: true, assignment: mapCoachAssignmentRow(updatedData as CoachAssignmentRow) })
}

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return null
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
