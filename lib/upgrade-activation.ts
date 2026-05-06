import type { PricingPlanId } from '@/lib/pricing-plans'

export type UpgradeActivationPayload = Record<string, boolean | string>
export type UpgradeActivationRequestStatus = 'pending' | 'contacted' | 'converted' | 'closed'

export type UpgradeActivationRequestSource = {
  id: string
  planId: PricingPlanId | string | null
  userId?: string | null
  status?: UpgradeActivationRequestStatus | string | null
}

export type UpgradeActivationTarget =
  | { ok: true; requestId: string; planId: PricingPlanId; userId: string }
  | { ok: false; status: number; message: string }

const ACTIVATABLE_PLAN_IDS: PricingPlanId[] = ['player_plus', 'captain', 'league']

export function resolveUpgradeActivationTarget(
  request: UpgradeActivationRequestSource | null | undefined,
): UpgradeActivationTarget {
  if (!request?.id) {
    return { ok: false, status: 404, message: 'Upgrade request was not found.' }
  }

  if (request.status === 'converted') {
    return { ok: false, status: 409, message: 'This request has already been activated.' }
  }

  if (request.status === 'closed') {
    return { ok: false, status: 409, message: 'This request is closed.' }
  }

  const userId = typeof request.userId === 'string' ? request.userId.trim() : ''
  if (!userId) {
    return { ok: false, status: 400, message: 'This request is not linked to an account yet.' }
  }

  const planId = request.planId
  if (!isActivatablePlanId(planId)) {
    return { ok: false, status: 400, message: 'This plan cannot be activated from the request queue.' }
  }

  return {
    ok: true,
    requestId: request.id,
    planId,
    userId,
  }
}

export function buildProfileActivationPayload(planId: PricingPlanId): UpgradeActivationPayload {
  if (planId === 'league') {
    return {
      tiq_team_league_entry_enabled: true,
      tiq_individual_league_creator_enabled: true,
    }
  }

  const payload: UpgradeActivationPayload = {
    player_plus_subscription_active: true,
    player_plus_subscription_status: 'active',
  }

  if (planId === 'captain') {
    payload.captain_subscription_active = true
    payload.captain_subscription_status = 'active'
  }

  return payload
}

function isActivatablePlanId(value: unknown): value is PricingPlanId {
  return typeof value === 'string' && ACTIVATABLE_PLAN_IDS.includes(value as PricingPlanId)
}
