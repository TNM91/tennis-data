import type { PricingPlanId } from '@/lib/pricing-plans'

export type UpgradeActivationPayload = Record<string, boolean | string>

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
