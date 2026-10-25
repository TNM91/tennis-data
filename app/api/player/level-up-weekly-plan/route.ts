import type { SupabaseClient } from '@supabase/supabase-js'
import { getSignedInPlayerApiAuth, loadPlayerAccess } from '@/lib/player-api-auth'
import {
  buildWeeklyLevelUpPlayerReply,
  mapWeeklyLevelUpPlanRow,
  parseWeeklyLevelUpPlan,
  setWeeklyLevelUpPlanShared,
  type WeeklyLevelUpPlanRow,
} from '@/lib/level-up/weekly-plan'

export const runtime = 'nodejs'

const planSelect = 'id,player_user_id,coach_user_id,student_link_id,identity_slug,week_start,shared_with_coach,plan_json,created_at,updated_at'

type CoachLinkRow = {
  id: string
  coach_user_id: string
}

export async function GET(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const identitySlug = url.searchParams.get('identitySlug')?.trim() ?? ''
  const weekStart = url.searchParams.get('weekStart')?.trim() ?? ''
  let query = auth.supabase
    .from('level_up_weekly_plans')
    .select(planSelect)
    .eq('player_user_id', auth.userId)
    .order('week_start', { ascending: false })
    .limit(12)

  if (identitySlug) query = query.eq('identity_slug', identitySlug)
  if (weekStart) query = query.eq('week_start', weekStart)

  const { data, error } = await query
  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

  const plans = ((data ?? []) as WeeklyLevelUpPlanRow[])
    .map(mapWeeklyLevelUpPlanRow)
    .filter((plan) => plan !== null)
  return Response.json({ ok: true, plans })
}

export async function POST(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  let body: { plan?: unknown; createOnly?: unknown }
  try {
    const value: unknown = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) return Response.json({ ok: false, message: 'Invalid weekly plan.' }, { status: 400 })
    body = value as typeof body
  } catch {
    return Response.json({ ok: false, message: 'Invalid weekly plan.' }, { status: 400 })
  }

  if (body.createOnly !== undefined && typeof body.createOnly !== 'boolean') return Response.json({ ok: false, message: 'Choose a valid save mode.' }, { status: 400 })
  const input = parseWeeklyLevelUpPlan(body.plan)
  if (!input) return Response.json({ ok: false, message: 'Add three valid reps before saving this week.' }, { status: 400 })

  const [access, link, existingResult] = await Promise.all([
    loadPlayerAccess(auth.supabase, auth.userId),
    resolveActiveCoachLink(auth.supabase, auth.userId, input.studentLinkId),
    auth.supabase
      .from('level_up_weekly_plans')
      .select(planSelect)
      .eq('player_user_id', auth.userId)
      .eq('week_start', input.weekStart)
      .eq('identity_slug', input.identitySlug)
      .maybeSingle(),
  ])
  if (existingResult.error) return Response.json({ ok: false, message: existingResult.error.message }, { status: 500 })
  if (!access.canUseAdvancedPlayerInsights && !link) {
    return Response.json(
      { ok: false, message: 'Saved locally. Player access or an active coach connection is required to sync across devices.' },
      { status: 403 },
    )
  }
  if (input.sharedWithCoach && !link) {
    return Response.json(
      { ok: false, code: 'coach_link_required', message: 'Connect a coach in My Lab before sharing this week.' },
      { status: 409 },
    )
  }

  const existingPlan = existingResult.data
    ? mapWeeklyLevelUpPlanRow(existingResult.data as WeeklyLevelUpPlanRow)
    : null
  if (body.createOnly && existingResult.data) return Response.json({ ok: false, code: 'plan_conflict', message: 'This week already has a plan. Refresh saved weeks to open it.' }, { status: 409 })
  const trustedInput = { ...input, coachResponse: existingPlan?.coachResponse ?? null }
  const linkedPlan = setWeeklyLevelUpPlanShared(trustedInput, input.sharedWithCoach, {
    coachUserId: link?.coach_user_id ?? null,
    studentLinkId: link?.id ?? null,
  })
  const storedPlan = {
    ...linkedPlan,
    id: `level-up-week-${auth.userId}-${linkedPlan.weekStart}-${cleanKey(linkedPlan.identitySlug)}`,
  }
  const payload = {
    id: storedPlan.id,
    player_user_id: auth.userId,
    coach_user_id: linkedPlan.coachUserId,
    student_link_id: linkedPlan.studentLinkId,
    identity_slug: linkedPlan.identitySlug,
    week_start: linkedPlan.weekStart,
    shared_with_coach: linkedPlan.sharedWithCoach,
    plan_json: storedPlan,
    updated_at: linkedPlan.updatedAt,
  }
  const table = auth.supabase.from('level_up_weekly_plans')
  const write = body.createOnly ? table.insert(payload) : table.upsert(payload, { onConflict: 'player_user_id,week_start,identity_slug' })
  const { data, error } = await write.select(planSelect).single()
  if (body.createOnly && error?.code === '23505') return Response.json({ ok: false, code: 'plan_conflict', message: 'This week was saved on another device. Refresh saved weeks.' }, { status: 409 })

  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
  return Response.json({ ok: true, plan: mapWeeklyLevelUpPlanRow(data as WeeklyLevelUpPlanRow) })
}

export async function PATCH(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  let body: { planId?: unknown; action?: unknown; message?: unknown; repId?: unknown; completed?: unknown; expectedUpdatedAt?: unknown }
  try {
    const value: unknown = await request.json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) return Response.json({ ok: false, message: 'Choose a valid plan action.' }, { status: 400 })
    body = value as typeof body
  } catch {
    return Response.json({ ok: false, message: 'Choose a reply first.' }, { status: 400 })
  }

  if (body.action === 'set_rep_completion') return setRepCompletion(auth.supabase, auth.userId, body)
  const planId = typeof body.planId === 'string' ? body.planId.trim() : ''
  const action = body.action === 'acknowledged' || body.action === 'question' ? body.action : null
  if (!planId || !action) return Response.json({ ok: false, message: 'Choose a reply first.' }, { status: 400 })

  const { data: row, error: findError } = await auth.supabase
    .from('level_up_weekly_plans')
    .select(planSelect)
    .eq('id', planId)
    .eq('player_user_id', auth.userId)
    .eq('shared_with_coach', true)
    .maybeSingle()
  if (findError) return Response.json({ ok: false, message: findError.message }, { status: 500 })

  const plan = row ? mapWeeklyLevelUpPlanRow(row as WeeklyLevelUpPlanRow) : null
  if (!plan?.coachResponse) {
    return Response.json({ ok: false, message: 'This coach update is no longer available.' }, { status: 404 })
  }

  const reply = buildWeeklyLevelUpPlayerReply(plan, {
    action,
    message: typeof body.message === 'string' ? body.message : '',
  }, auth.userId)
  if (!reply) {
    return Response.json({ ok: false, message: action === 'question' ? 'Add your question before sending.' : 'Choose a reply first.' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .rpc('reply_to_level_up_weekly_plan', { p_plan_id: plan.id, p_reply: reply })
    .select(planSelect)
    .single()
  if (error) return Response.json({ ok: false, message: error.message }, { status: 400 })
  return Response.json({ ok: true, plan: mapWeeklyLevelUpPlanRow(data as WeeklyLevelUpPlanRow) })
}

function cleanKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'default'
}

async function resolveActiveCoachLink(supabase: SupabaseClient, userId: string, requestedLinkId: string | null) {
  let query = supabase
    .from('coach_player_links')
    .select('id,coach_user_id')
    .eq('player_user_id', userId)
    .in('status', ['active', 'needs_assignment', 'review_notes'])

  if (requestedLinkId) query = query.eq('id', requestedLinkId)

  const { data } = await query
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data ?? null) as CoachLinkRow | null
}

async function setRepCompletion(supabase: SupabaseClient, userId: string, body: { planId?: unknown; repId?: unknown; completed?: unknown; expectedUpdatedAt?: unknown }) {
  const planId = typeof body.planId === 'string' ? body.planId.trim() : ''
  const repId = typeof body.repId === 'string' ? body.repId.trim() : ''
  const revision = typeof body.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt : ''
  if (!planId || planId.length > 240 || !repId || repId.length > 120 || typeof body.completed !== 'boolean' || revision.length > 80 || !Number.isFinite(Date.parse(revision))) return Response.json({ ok: false, message: 'Refresh the plan before changing a rep.' }, { status: 400 })
  const { data: row, error: findError } = await supabase.from('level_up_weekly_plans').select(planSelect).eq('id', planId).eq('player_user_id', userId).maybeSingle()
  if (findError) return Response.json({ ok: false, message: 'The plan could not be loaded.' }, { status: 500 })
  if (!row || row.player_user_id !== userId) return Response.json({ ok: false, message: 'This plan is not available.' }, { status: 404 })
  const plan = mapWeeklyLevelUpPlanRow(row as WeeklyLevelUpPlanRow)
  if (!plan || !plan.reps.some(rep => rep.id === repId)) return Response.json({ ok: false, message: 'This rep is not available.' }, { status: 404 })
  const [access, link] = await Promise.all([loadPlayerAccess(supabase, userId), resolveActiveCoachLink(supabase, userId, plan.studentLinkId)])
  if (!access.canUseAdvancedPlayerInsights && !link) return Response.json({ ok: false, message: 'Player access or an active coach connection is required.' }, { status: 403 })
  if (plan.sharedWithCoach && !link) return Response.json({ ok: false, code: 'plan_conflict', message: 'The coach connection changed. Refresh this week.' }, { status: 409 })
  if (row.updated_at !== revision) return Response.json({ ok: false, code: 'plan_conflict', message: 'This plan changed. Refresh before updating the rep.' }, { status: 409 })
  if (Boolean(plan.reps.find(rep => rep.id === repId)?.completedAt) === body.completed) return Response.json({ ok: true, plan })
  const raw = row.plan_json as Record<string, unknown>
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.reps) || raw.reps.length !== plan.reps.length) return Response.json({ ok: false, message: 'The saved plan needs review.' }, { status: 500 })
  const timestamp = new Date(Math.max(Date.now(), Date.parse(row.updated_at) + 1)).toISOString()
  const reps = raw.reps.map(value => { const rep = value as Record<string, unknown>; return rep.id === repId ? { ...rep, completedAt: body.completed ? timestamp : null } : rep })
  const { data, error } = await supabase.from('level_up_weekly_plans').update({ plan_json: { ...raw, reps, updatedAt: timestamp }, updated_at: timestamp }).eq('id', planId).eq('player_user_id', userId).eq('updated_at', row.updated_at).select(planSelect).maybeSingle()
  if (error) return Response.json({ ok: false, message: 'The rep change could not be confirmed.' }, { status: 500 })
  if (!data) return Response.json({ ok: false, code: 'plan_conflict', message: 'This plan changed while saving. Refresh before trying again.' }, { status: 409 })
  return Response.json({ ok: true, plan: mapWeeklyLevelUpPlanRow(data as WeeklyLevelUpPlanRow) })
}
