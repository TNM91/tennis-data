import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  buildPlayerAssignmentPackCardCompletion,
  mapCoachAssignmentRow,
  type CoachAssignmentRow,
} from '@/lib/coach-storage'
import {
  buildLevelUpSessionPayload,
  mapLevelUpSessionRow,
  normalizeAccessMode,
  type LevelUpSessionInput,
  type LevelUpSessionRow,
} from '@/lib/level-up-sessions'
import { getSignedInPlayerApiAuth, loadPlayerAccess } from '@/lib/player-api-auth'
import { MEMBERSHIP_TIERS } from '@/lib/product-story'
import { supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

const sessionSelect =
  'id,player_user_id,coach_user_id,student_link_id,assignment_id,identity_slug,focus_id,focus_title,work_type,training_context,drill_title,rating,feeling,access_mode,note,elapsed_seconds,shared_with_coach,completed_at,created_at,updated_at'

const PLAYER_TIER_NAME = MEMBERSHIP_TIERS.player_plus.name

type SaveLevelUpBody = {
  session?: LevelUpSessionInput
}

type CoachLinkRow = {
  id: string
  coach_user_id: string | null
}

export async function GET(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('level_up_sessions')
    .select(sessionSelect)
    .eq('player_user_id', auth.userId)
    .order('completed_at', { ascending: false })
    .limit(80)

  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

  const sessions = ((data ?? []) as LevelUpSessionRow[]).map(mapLevelUpSessionRow)
  return Response.json({ ok: true, sessions })
}

export async function POST(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  let body: SaveLevelUpBody
  try {
    body = (await request.json()) as SaveLevelUpBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid Level Up session.' }, { status: 400 })
  }

  const input = body.session ?? {}
  const accessMode = normalizeAccessMode(input.accessMode)
  if (accessMode === 'free_preview') {
    return Response.json(
      { ok: false, message: `Free preview logs stay on this device. Use a coach invite or ${PLAYER_TIER_NAME} to sync.` },
      { status: 403 },
    )
  }

  const link = await resolveLevelUpLink(auth.supabase, auth.userId, input)
  if (accessMode === 'coach_invited' && !link) {
    return Response.json(
      { ok: false, message: 'Connect with a coach invite before syncing coach-visible Level Up work.' },
      { status: 403 },
    )
  }

  if (accessMode === 'player_plus') {
    const access = await loadPlayerAccess(auth.supabase, auth.userId)
    if (!access.canUseAdvancedPlayerInsights) {
      return Response.json(
        { ok: false, message: `${PLAYER_TIER_NAME} is required to sync self-guided Level Up history across devices.` },
        { status: 403 },
      )
    }
  }

  const payload = buildLevelUpSessionPayload(input, auth.userId, {
    coachUserId: accessMode === 'coach_invited' ? link?.coach_user_id ?? null : null,
    studentLinkId: accessMode === 'coach_invited' ? link?.id ?? null : null,
  })

  if (!payload) {
    return Response.json({ ok: false, message: 'Focus, drill, and rating are required.' }, { status: 400 })
  }

  const service = getServiceClient()
  const client = service ?? auth.supabase
  const { data, error } = await client
    .from('level_up_sessions')
    .upsert(payload, { onConflict: 'id' })
    .select(sessionSelect)
    .single()

  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

  if (accessMode === 'coach_invited' && payload.assignment_id && link) {
    await completeLinkedAssignment(client, payload.assignment_id, link.id, {
      cardId: payload.focus_id,
      levelUpSessionId: payload.id,
      rating: payload.rating,
      completedAt: payload.completed_at,
      recap: `${payload.focus_title}: ${payload.drill_title} (${payload.rating}/5, ${payload.feeling}, ${formatClock(payload.elapsed_seconds)})${payload.note ? ` - ${payload.note}` : ''}`,
      evidence: 'Level Up training log',
    })
  }

  return Response.json({ ok: true, session: mapLevelUpSessionRow(data as LevelUpSessionRow) })
}

async function resolveLevelUpLink(
  supabase: SupabaseClient,
  userId: string,
  input: LevelUpSessionInput,
) {
  const studentLinkId = typeof input.studentLinkId === 'string' ? input.studentLinkId.trim() : ''
  const assignmentId = typeof input.assignmentId === 'string' ? input.assignmentId.trim() : ''

  if (assignmentId) {
    const { data: assignmentData } = await supabase
      .from('coach_assignments')
      .select('id,student_link_id,title,focus,due_date,status,assignment_json,updated_at')
      .eq('id', assignmentId)
      .maybeSingle()

    if (assignmentData) {
      const assignment = mapCoachAssignmentRow(assignmentData as CoachAssignmentRow)
      return getOwnedCoachLink(supabase, userId, assignment.studentLinkId)
    }
  }

  if (studentLinkId) {
    return getOwnedCoachLink(supabase, userId, studentLinkId)
  }

  const { data } = await supabase
    .from('coach_player_links')
    .select('id,coach_user_id')
    .eq('player_user_id', userId)
    .in('status', ['active', 'needs_assignment', 'review_notes'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data ?? null) as CoachLinkRow | null
}

async function getOwnedCoachLink(
  supabase: SupabaseClient,
  userId: string,
  studentLinkId: string,
) {
  const { data } = await supabase
    .from('coach_player_links')
    .select('id,coach_user_id')
    .eq('id', studentLinkId)
    .eq('player_user_id', userId)
    .maybeSingle()

  return (data ?? null) as CoachLinkRow | null
}

async function completeLinkedAssignment(
  client: SupabaseClient,
  assignmentId: string,
  studentLinkId: string,
  input: { cardId: string; levelUpSessionId: string; rating: number; completedAt: string; recap: string; evidence: string },
) {
  const { data: existingData } = await client
    .from('coach_assignments')
    .select('id,student_link_id,title,focus,due_date,status,assignment_json,updated_at')
    .eq('id', assignmentId)
    .eq('student_link_id', studentLinkId)
    .maybeSingle()

  if (!existingData) return

  const existing = mapCoachAssignmentRow(existingData as CoachAssignmentRow)
  if (existing.status === 'archived') return

  const packCompletion = buildPlayerAssignmentPackCardCompletion(existing.assignment, input)
  if (!packCompletion.updatedCardId) return

  await client
    .from('coach_assignments')
    .update({
      status: packCompletion.complete ? 'completed' : 'assigned',
      assignment_json: packCompletion.assignment,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
    .eq('student_link_id', studentLinkId)
}

function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return null
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
