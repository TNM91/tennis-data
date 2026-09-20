import { buildProductAccessState, normalizeSubscriptionStatus, type ProductEntitlementRow } from './access-model-core'
import { normalizeUserRole } from './roles'
import type { MembershipTierId } from './product-story'

export type AccountTierRow = ProductEntitlementRow & {
  role?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
}

export type AccountHealthKey = 'paid' | 'trial' | 'complimentary' | 'pastDue' | 'expiring'

export type AccountHealthCounts = Record<AccountHealthKey, number>

export type AccountTierCounts = Record<MembershipTierId, number> & {
  total: number
  admins: number
}

export type AccountTierSummary = {
  counts: AccountTierCounts
  healthByTier: Record<MembershipTierId, AccountHealthCounts>
  healthTotals: AccountHealthCounts
}

const TIER_IDS: MembershipTierId[] = ['free', 'player_plus', 'coach', 'captain', 'league', 'full_court']

function emptyHealthCounts(): AccountHealthCounts {
  return { paid: 0, trial: 0, complimentary: 0, pastDue: 0, expiring: 0 }
}

function hasStatus(row: AccountTierRow, status: string) {
  return row.player_plus_subscription_status === status ||
    row.coach_subscription_status === status ||
    row.captain_subscription_status === status
}

function expiresWithin(row: AccountTierRow, days: number, now: number) {
  const latestActiveExpiry = Math.max(
    ...[
      row.player_plus_subscription_active ? row.player_plus_access_expires_at : null,
      row.coach_subscription_active ? row.coach_access_expires_at : null,
      row.captain_subscription_active ? row.captain_access_expires_at : null,
      row.tiq_team_league_entry_enabled || row.tiq_individual_league_creator_enabled
        ? row.league_access_expires_at
        : null,
    ].map((value) => Date.parse(value ?? '') || 0),
  )

  return latestActiveExpiry > now && latestActiveExpiry <= now + days * 24 * 60 * 60 * 1000
}

export function getAccountHealth(
  row: AccountTierRow,
  now = Date.now(),
) {
  const trial = hasStatus(row, 'trial')
  const pastDue = hasStatus(row, 'past_due')
  const canceled = hasStatus(row, 'canceled')
  const stripeManaged = Boolean(row.stripe_customer_id || row.stripe_subscription_id)

  return {
    paid: stripeManaged && !trial && !pastDue && !canceled,
    trial,
    complimentary: !stripeManaged && !trial && !pastDue,
    pastDue,
    expiring: expiresWithin(row, 14, now),
  }
}

export function summarizeAccountTiers(rows: AccountTierRow[], now = Date.now()): AccountTierSummary {
  const healthByTier = TIER_IDS.reduce<Record<MembershipTierId, AccountHealthCounts>>((acc, tier) => {
    acc[tier] = emptyHealthCounts()
    return acc
  }, {} as Record<MembershipTierId, AccountHealthCounts>)
  const healthTotals = emptyHealthCounts()
  const counts = countAccountTiers(rows)

  for (const row of rows) {
    const role = normalizeUserRole(row.role)
    if (role === 'admin') continue

    const tier = getAccountTier(row)
    const health = getAccountHealth(row, now)
    if (tier === 'free') {
      for (const key of ['pastDue', 'expiring'] as AccountHealthKey[]) {
        if (!health[key]) continue
        healthByTier.free[key] += 1
        healthTotals[key] += 1
      }
      continue
    }

    for (const key of Object.keys(health) as AccountHealthKey[]) {
      if (!health[key]) continue
      healthByTier[tier][key] += 1
      healthTotals[key] += 1
    }
  }

  return { counts, healthByTier, healthTotals }
}

function getAccountTier(row: AccountTierRow): MembershipTierId {
  const role = normalizeUserRole(row.role)
  return buildProductAccessState(role, {
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

    const tier = getAccountTier(row)
    counts[tier] += 1
  }

  return counts
}
