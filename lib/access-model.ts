'use client'

import { supabase } from './supabase'
import {
  DEFAULT_ENTITLEMENTS,
  normalizeSubscriptionStatus,
  type ProductEntitlementRow,
  type ProductEntitlementSnapshot,
} from './access-model-core'

export * from './access-model-core'

export async function getClientEntitlementSnapshot(
  userId: string | null | undefined,
): Promise<ProductEntitlementSnapshot | null> {
  if (!userId) return null

  try {
    const result = await supabase
      .from('profiles')
      .select(
        'player_plus_subscription_active, player_plus_subscription_status, coach_subscription_active, coach_subscription_status, captain_subscription_active, captain_subscription_status, tiq_team_league_entry_enabled, tiq_individual_league_creator_enabled',
      )
      .eq('id', userId)
      .maybeSingle()

    let data = result.data
    if (result.error) {
      const legacyResult = await supabase
        .from('profiles')
        .select(
          'captain_subscription_active, captain_subscription_status, tiq_team_league_entry_enabled, tiq_individual_league_creator_enabled',
        )
        .eq('id', userId)
        .maybeSingle()

      if (legacyResult.error) throw legacyResult.error
      data = legacyResult.data
        ? {
            ...legacyResult.data,
            player_plus_subscription_active: false,
            player_plus_subscription_status: 'inactive',
            coach_subscription_active: false,
            coach_subscription_status: 'inactive',
          }
        : null
    }

    const row = (data || null) as ProductEntitlementRow | null
    if (!row) return DEFAULT_ENTITLEMENTS

    return {
      playerPlusSubscriptionActive: Boolean(row.player_plus_subscription_active),
      playerPlusSubscriptionStatus: normalizeSubscriptionStatus(row.player_plus_subscription_status),
      coachSubscriptionActive: Boolean(row.coach_subscription_active),
      coachSubscriptionStatus: normalizeSubscriptionStatus(row.coach_subscription_status),
      captainSubscriptionActive: Boolean(row.captain_subscription_active),
      captainSubscriptionStatus: normalizeSubscriptionStatus(row.captain_subscription_status),
      tiqTeamLeagueEntryEnabled: Boolean(row.tiq_team_league_entry_enabled),
      tiqIndividualLeagueCreatorEnabled: Boolean(row.tiq_individual_league_creator_enabled),
    }
  } catch {
    return null
  }
}
