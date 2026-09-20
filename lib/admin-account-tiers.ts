import { buildProductAccessState, normalizeSubscriptionStatus, type ProductEntitlementRow } from './access-model-core'
import { normalizeUserRole } from './roles'
import type { MembershipTierId } from './product-story'

export type AccountTierRow = ProductEntitlementRow & { role?: string | null }

export type AccountTierCounts = Record<MembershipTierId, number> & {
  total: number
  admins: number
}

export function countAccountTiers(rows: AccountTierRow[]): AccountTierCounts {
  const counts: AccountTierCounts = {
    total: 0,
    admins: 0,
    free: 0,
    player_plus: 0,
    coach: 0,
    captain: 0,
    league: 0,
    full_court: 0,
  }

  for (const row of rows) {
    counts.total += 1
    const role = normalizeUserRole(row.role)
    // Admins have platform-wide access, not a customer membership tier.
    if (role === 'admin') {
      counts.admins += 1
      continue
    }

    const tier = buildProductAccessState(role, {
      playerPlusSubscriptionActive: Boolean(row.player_plus_subscription_active),
      playerPlusSubscriptionStatus: normalizeSubscriptionStatus(row.player_plus_subscription_status),
      playerPlusAccessExpiresAt: row.player_plus_access_expires_at,
      coachSubscriptionActive: Boolean(row.coach_subscription_active),
      coachSubscriptionStatus: normalizeSubscriptionStatus(row.coach_subscription_status),
      coachAccessExpiresAt: row.coach_access_expires_at,
      captainSubscriptionActive: Boolean(row.captain_subscription_active),
      captainSubscriptionStatus: normalizeSubscriptionStatus(row.captain_subscription_status),
      captainAccessExpiresAt: row.captain_access_expires_at,
      tiqTeamLeagueEntryEnabled: Boolean(row.tiq_team_league_entry_enabled),
      tiqIndividualLeagueCreatorEnabled: Boolean(row.tiq_individual_league_creator_enabled),
      leagueAccessExpiresAt: row.league_access_expires_at,
    }).currentPlanId
    counts[tier] += 1
  }

  return counts
}
