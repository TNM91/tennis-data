import type { SupabaseClient } from '@supabase/supabase-js'
import { getSignedInPlayerApiAuth, loadPlayerAccess } from '@/lib/player-api-auth'
import {
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

  let body: { plan?: unknown }
  try {
    body = (await request.json()) as { plan?: unknown }
  } catch {
    return Response.json({ ok: false, message: 'Invalid weekly plan.' }, { status: 400 })
  }

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
  const { data, error } = await auth.supabase
    .from('level_up_weekly_plans')
    .upsert(payload, { onConflict: 'player_user_id,week_start,identity_slug' })
    .select(planSelect)
    .single()

  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
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
