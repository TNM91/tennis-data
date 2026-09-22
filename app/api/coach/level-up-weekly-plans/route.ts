import { getCoachApiAuth } from '@/lib/coach-api-auth'
import { LEVEL_UP_CARDS } from '@/lib/level-up/level-up-cards'
import {
  buildWeeklyLevelUpCoachNotification,
  buildWeeklyLevelUpCoachResponse,
  mapWeeklyLevelUpPlanRow,
  type WeeklyLevelUpCoachResponse,
  type WeeklyLevelUpPlanRow,
} from '@/lib/level-up/weekly-plan'

export const runtime = 'nodejs'

const planSelect = 'id,player_user_id,coach_user_id,student_link_id,identity_slug,week_start,shared_with_coach,plan_json,created_at,updated_at'

export async function GET(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const studentLinkId = url.searchParams.get('studentLinkId')?.trim() ?? ''
  let query = auth.supabase
    .from('level_up_weekly_plans')
    .select(planSelect)
    .eq('coach_user_id', auth.userId)
    .eq('shared_with_coach', true)
    .order('week_start', { ascending: false })
    .limit(100)

  if (studentLinkId) query = query.eq('student_link_id', studentLinkId)

  const { data, error } = await query
  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

  const plans = ((data ?? []) as WeeklyLevelUpPlanRow[])
    .map(mapWeeklyLevelUpPlanRow)
    .filter((plan) => plan !== null)
  return Response.json({ ok: true, plans })
}

export async function PATCH(request: Request) {
  const auth = await getCoachApiAuth(request)
  if (!auth.ok) return auth.response

  let body: {
    planId?: unknown
    action?: unknown
    note?: unknown
    targetRepId?: unknown
    replacementCardId?: unknown
  }
  try {
    body = await request.json() as typeof body
  } catch {
    return Response.json({ ok: false, message: 'Add a valid coach response.' }, { status: 400 })
  }

  const planId = cleanText(body.planId)
  const action = parseAction(body.action)
  if (!planId || !action) return Response.json({ ok: false, message: 'Choose how you want to guide this week.' }, { status: 400 })

  const { data: row, error: rowError } = await auth.supabase
    .from('level_up_weekly_plans')
    .select(planSelect)
    .eq('id', planId)
    .eq('coach_user_id', auth.userId)
    .eq('shared_with_coach', true)
    .maybeSingle()
  if (rowError) return Response.json({ ok: false, message: rowError.message }, { status: 500 })
  const plan = row ? mapWeeklyLevelUpPlanRow(row as WeeklyLevelUpPlanRow) : null
  if (!plan) return Response.json({ ok: false, message: 'This shared week is no longer available.' }, { status: 404 })

  const targetRepId = cleanText(body.targetRepId)
  const targetRep = plan.reps.find((rep) => rep.id === targetRepId) ?? null
  if (action === 'answered' && plan.coachResponse?.playerReply?.action !== 'question') {
    return Response.json({ ok: false, message: 'That player question has already been answered.' }, { status: 409 })
  }
  const replacementCard = action === 'replaced'
    ? LEVEL_UP_CARDS.find((card) => card.id === cleanText(body.replacementCardId) && card.assignable) ?? null
    : null
  const needsTargetRep = action === 'adjusted' || action === 'replaced'
  if (needsTargetRep && !targetRep) {
    return Response.json({ ok: false, message: 'Choose the rep you want to guide.' }, { status: 400 })
  }
  if (action === 'replaced' && targetRep?.completedAt) {
    return Response.json({ ok: false, message: 'That rep is already complete. Adjust the next rep instead.' }, { status: 409 })
  }
  if (action === 'replaced' && !replacementCard) {
    return Response.json({ ok: false, message: 'Choose a replacement Level Up rep.' }, { status: 400 })
  }

  const note = cleanText(body.note)
    || (action === 'acknowledged'
      ? 'Plan reviewed. Keep the week simple and finish the next rep.'
      : action === 'replaced' && replacementCard
        ? `Use ${replacementCard.title} for this rep.`
        : '')
  const coachResponse = buildWeeklyLevelUpCoachResponse(plan, {
    action,
    note,
    targetRepId: needsTargetRep ? targetRep?.id ?? null : null,
    replacementRep: targetRep && replacementCard ? {
      id: targetRep.id,
      kind: targetRep.kind,
      focusId: targetRep.focusId,
      identitySlug: targetRep.identitySlug,
      label: 'Coach pick',
      title: replacementCard.title,
      detail: replacementCard.cue || replacementCard.tennisGoal,
      href: `/level-up/${encodeURIComponent(targetRep.identitySlug)}?focus=${encodeURIComponent(targetRep.focusId)}&card=${encodeURIComponent(replacementCard.id)}#level-up-flow`,
    } : null,
  }, auth.userId)
  if (!coachResponse) {
    return Response.json({ ok: false, message: 'Add the coach guidance before sending.' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .rpc('respond_to_level_up_weekly_plan', { p_plan_id: plan.id, p_response: coachResponse })
    .single()
  if (error) return Response.json({ ok: false, message: error.message }, { status: 400 })

  const notification = buildWeeklyLevelUpCoachNotification(plan, coachResponse)
  const { error: notificationError } = await auth.supabase.from('internal_notifications').insert({
    recipient_profile_id: (row as WeeklyLevelUpPlanRow).player_user_id,
    actor_user_id: auth.userId,
    notification_type: 'message',
    title: notification.title,
    body: notification.body,
    href: notification.href,
  })

  return Response.json({
    ok: true,
    plan: mapWeeklyLevelUpPlanRow(data as WeeklyLevelUpPlanRow),
    notificationQueued: !notificationError,
  })
}

function parseAction(value: unknown): WeeklyLevelUpCoachResponse['action'] | null {
  return value === 'acknowledged' || value === 'answered' || value === 'adjusted' || value === 'replaced' ? value : null
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 500) : ''
}
