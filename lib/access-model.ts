'use client'

import { supabase } from './supabase'
import { isCaptain, isMember, type UserRole } from './roles'
import { getPricingPlan, type PricingPlanId } from './pricing-plans'
import { MEMBERSHIP_TIERS } from './product-story'

export const CAPTAIN_SUBSCRIPTION_PRICE_LABEL = getPricingPlan('captain').priceLabel
export const PLAYER_PRICE_LABEL = getPricingPlan('player_plus').priceLabel
export const PLAYER_PLUS_PRICE_LABEL = PLAYER_PRICE_LABEL
export const LEAGUE_PRICE_LABEL = getPricingPlan('league').priceLabel
export const TIQ_SEASON_FEE_PRICE_LABEL = '$25/season'

const PLAYER_TIER = MEMBERSHIP_TIERS.player_plus
const CAPTAIN_TIER = MEMBERSHIP_TIERS.captain
const LEAGUE_TIER = MEMBERSHIP_TIERS.league

export type CaptainSubscriptionStatus = 'inactive' | 'trial' | 'active' | 'past_due' | 'canceled'

export type ProductEntitlementSnapshot = {
  playerPlusSubscriptionActive: boolean
  playerPlusSubscriptionStatus: CaptainSubscriptionStatus
  captainSubscriptionActive: boolean
  captainSubscriptionStatus: CaptainSubscriptionStatus
  tiqTeamLeagueEntryEnabled: boolean
  tiqIndividualLeagueCreatorEnabled: boolean
}

export type ProductAccessState = {
  role: UserRole
  activePlanIds: PricingPlanId[]
  currentPlanId: PricingPlanId
  recommendedUpgradePlanId: PricingPlanId | null
  captainSubscriptionActive: boolean
  captainSubscriptionStatus: CaptainSubscriptionStatus
  tiqTeamLeagueEntryEnabled: boolean
  tiqIndividualLeagueCreatorEnabled: boolean
  canUseAdvancedPlayerInsights: boolean
  canUsePlayerProjections: boolean
  canUseCaptainWorkflow: boolean
  canUseLeagueTools: boolean
  canCreateTiqTeamLeague: boolean
  canEnterTiqTeamLeague: boolean
  canCreateTiqIndividualLeague: boolean
  canJoinTiqIndividualLeague: boolean
  playerPlusLabel: string
  playerPlusMessage: string
  captainTierLabel: string
  captainTierMessage: string
  leagueTierLabel: string
  leagueTierMessage: string
  teamLeagueMessage: string
  individualLeagueMessage: string
}

type ProductEntitlementRow = {
  player_plus_subscription_active?: boolean | null
  player_plus_subscription_status?: string | null
  captain_subscription_active?: boolean | null
  captain_subscription_status?: string | null
  tiq_team_league_entry_enabled?: boolean | null
  tiq_individual_league_creator_enabled?: boolean | null
}

const DEFAULT_ENTITLEMENTS: ProductEntitlementSnapshot = {
  playerPlusSubscriptionActive: false,
  playerPlusSubscriptionStatus: 'inactive',
  captainSubscriptionActive: false,
  captainSubscriptionStatus: 'inactive',
  tiqTeamLeagueEntryEnabled: false,
  tiqIndividualLeagueCreatorEnabled: false,
}

function normalizeCaptainSubscriptionStatus(value: string | null | undefined): CaptainSubscriptionStatus {
  if (value === 'trial') return 'trial'
  if (value === 'active') return 'active'
  if (value === 'past_due') return 'past_due'
  if (value === 'canceled') return 'canceled'
  return 'inactive'
}

function buildActivePlanIds({
  playerPlusActive,
  captainActive,
  leagueToolsActive,
}: {
  playerPlusActive: boolean
  captainActive: boolean
  leagueToolsActive: boolean
}) {
  const planIds: PricingPlanId[] = ['free']

  if (playerPlusActive) {
    planIds.push('player_plus')
  }

  if (captainActive) {
    planIds.push('captain')
  }

  if (leagueToolsActive) {
    planIds.push('league')
  }

  return planIds
}

export function hasPlanAccess(activePlanIds: PricingPlanId[], requiredPlanId: PricingPlanId) {
  if (requiredPlanId === 'free') return true
  if (requiredPlanId === 'player_plus') {
    return activePlanIds.includes('player_plus') || activePlanIds.includes('captain')
  }

  return activePlanIds.includes(requiredPlanId)
}

export function getRoleBackedEntitlements(role: UserRole): ProductEntitlementSnapshot {
  const captainSubscriptionActive = isCaptain(role)
  const isPlatformAdmin = role === 'admin'

  return {
    captainSubscriptionActive,
    captainSubscriptionStatus: captainSubscriptionActive ? 'active' : 'inactive',
    playerPlusSubscriptionActive: captainSubscriptionActive,
    playerPlusSubscriptionStatus: captainSubscriptionActive ? 'active' : 'inactive',
    tiqTeamLeagueEntryEnabled: isPlatformAdmin,
    tiqIndividualLeagueCreatorEnabled: isPlatformAdmin,
  }
}

export function buildProductAccessState(
  role: UserRole,
  entitlements?: Partial<ProductEntitlementSnapshot> | null,
): ProductAccessState {
  const fallback = getRoleBackedEntitlements(role)
  const snapshot: ProductEntitlementSnapshot = {
    ...DEFAULT_ENTITLEMENTS,
    ...fallback,
    ...entitlements,
    playerPlusSubscriptionStatus: normalizeCaptainSubscriptionStatus(
      entitlements?.playerPlusSubscriptionStatus ?? fallback.playerPlusSubscriptionStatus,
    ),
    captainSubscriptionStatus: normalizeCaptainSubscriptionStatus(
      entitlements?.captainSubscriptionStatus ?? fallback.captainSubscriptionStatus,
    ),
  }

  const signedInMember = isMember(role)
  const captainSubscriptionActive = role === 'admin' || snapshot.captainSubscriptionActive
  const playerPlusActive = snapshot.playerPlusSubscriptionActive || captainSubscriptionActive
  const leagueToolsActive =
    role === 'admin' || snapshot.tiqTeamLeagueEntryEnabled || snapshot.tiqIndividualLeagueCreatorEnabled

  const activePlanIds = buildActivePlanIds({
    playerPlusActive,
    captainActive: captainSubscriptionActive,
    leagueToolsActive,
  })

  const currentPlanId: PricingPlanId = captainSubscriptionActive
    ? 'captain'
    : leagueToolsActive
      ? 'league'
      : playerPlusActive
        ? 'player_plus'
        : 'free'

  const recommendedUpgradePlanId: PricingPlanId | null =
    role === 'admin'
      ? null
      : isCaptain(role)
        ? leagueToolsActive
          ? null
          : 'league'
        : leagueToolsActive
          ? null
        : signedInMember
          ? 'player_plus'
          : 'free'

  const canUseAdvancedPlayerInsights = hasPlanAccess(activePlanIds, 'player_plus')
  const canUsePlayerProjections = hasPlanAccess(activePlanIds, 'player_plus')
  const canUseCaptainWorkflow = hasPlanAccess(activePlanIds, 'captain')
  const canUseLeagueTools = hasPlanAccess(activePlanIds, 'league')
  const canCreateTiqTeamLeague = canUseLeagueTools && snapshot.tiqTeamLeagueEntryEnabled
  const canEnterTiqTeamLeague = canUseLeagueTools && snapshot.tiqTeamLeagueEntryEnabled
  const canCreateTiqIndividualLeague = canUseLeagueTools && snapshot.tiqIndividualLeagueCreatorEnabled
  const canJoinTiqIndividualLeague = signedInMember
  const captainTierStatusLabel =
    snapshot.captainSubscriptionStatus === 'trial'
      ? 'trial'
      : snapshot.captainSubscriptionStatus === 'past_due'
        ? 'past due'
        : snapshot.captainSubscriptionStatus === 'canceled'
          ? 'canceled'
          : captainSubscriptionActive
            ? 'active'
            : 'inactive'

  return {
    role,
    activePlanIds,
    currentPlanId,
    recommendedUpgradePlanId,
    ...snapshot,
    canUseAdvancedPlayerInsights,
    canUsePlayerProjections,
    canUseCaptainWorkflow,
    canUseLeagueTools,
    canCreateTiqTeamLeague,
    canEnterTiqTeamLeague,
    canCreateTiqIndividualLeague,
    canJoinTiqIndividualLeague,
    playerPlusLabel: playerPlusActive
      ? `${PLAYER_TIER.name} active`
      : `${PLAYER_TIER.name} - ${PLAYER_PRICE_LABEL}`,
    playerPlusMessage: playerPlusActive
      ? `${PLAYER_TIER.name} tools are active. ${PLAYER_TIER.description}`
      : PLAYER_TIER.description,
    captainTierLabel: captainSubscriptionActive
      ? `${CAPTAIN_TIER.name} ${captainTierStatusLabel}`
      : `${CAPTAIN_TIER.name} - ${CAPTAIN_SUBSCRIPTION_PRICE_LABEL}`,
    captainTierMessage: captainSubscriptionActive
      ? `${CAPTAIN_TIER.name} tools are active. ${CAPTAIN_TIER.description}`
      : CAPTAIN_TIER.description,
    leagueTierLabel: canUseLeagueTools
      ? `${LEAGUE_TIER.name} active`
      : `${LEAGUE_TIER.name} - ${LEAGUE_PRICE_LABEL}`,
    leagueTierMessage: canUseLeagueTools
      ? `${LEAGUE_TIER.name} tools are active. ${LEAGUE_TIER.description}`
      : LEAGUE_TIER.description,
    teamLeagueMessage: canCreateTiqTeamLeague
      ? `${LEAGUE_TIER.name} tools are active. Create team leagues, structure participants, and keep competition inside TIQ.`
      : `${LEAGUE_TIER.upgradeCue} Team leagues keep teams, season flow, and competition tools together.`,
    individualLeagueMessage: canCreateTiqIndividualLeague
      ? `${LEAGUE_TIER.name} tools are active. Create the competition container, organize players, and keep standings out of spreadsheets.`
      : `${LEAGUE_TIER.upgradeCue} Individual leagues can start without forcing every player into a subscription.`,
  }
}

export function shouldShowSponsoredPlacements(access: ProductAccessState) {
  return !access.canUseAdvancedPlayerInsights && !access.canUseCaptainWorkflow && !access.canUseLeagueTools
}

export async function getClientEntitlementSnapshot(
  userId: string | null | undefined,
): Promise<ProductEntitlementSnapshot | null> {
  if (!userId) return null

  try {
    const result = await supabase
      .from('profiles')
      .select(
        'player_plus_subscription_active, player_plus_subscription_status, captain_subscription_active, captain_subscription_status, tiq_team_league_entry_enabled, tiq_individual_league_creator_enabled',
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
          }
        : null
    }

    const row = (data || null) as ProductEntitlementRow | null
    if (!row) return null

    return {
      playerPlusSubscriptionActive: Boolean(row.player_plus_subscription_active),
      playerPlusSubscriptionStatus: normalizeCaptainSubscriptionStatus(row.player_plus_subscription_status),
      captainSubscriptionActive: Boolean(row.captain_subscription_active),
      captainSubscriptionStatus: normalizeCaptainSubscriptionStatus(row.captain_subscription_status),
      tiqTeamLeagueEntryEnabled: Boolean(row.tiq_team_league_entry_enabled),
      tiqIndividualLeagueCreatorEnabled: Boolean(row.tiq_individual_league_creator_enabled),
    }
  } catch {
    return null
  }
}
