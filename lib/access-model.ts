'use client'

import { supabase } from './supabase'
import { isCaptain, isMember, type UserRole } from './roles'
import { getPricingPlan, type PricingPlanId } from './pricing-plans'
import { MEMBERSHIP_TIERS } from './product-story'

export const CAPTAIN_SUBSCRIPTION_PRICE_LABEL = getPricingPlan('captain').priceLabel
export const COACH_SUBSCRIPTION_PRICE_LABEL = getPricingPlan('coach').priceLabel
export const PLAYER_PRICE_LABEL = getPricingPlan('player_plus').priceLabel
export const PLAYER_PLUS_PRICE_LABEL = PLAYER_PRICE_LABEL
export const LEAGUE_PRICE_LABEL = getPricingPlan('league').priceLabel
export const FULL_COURT_PRICE_LABEL = getPricingPlan('full_court').priceLabel
export const TIQ_SEASON_FEE_PRICE_LABEL = LEAGUE_PRICE_LABEL

const PLAYER_TIER = MEMBERSHIP_TIERS.player_plus
const COACH_TIER = MEMBERSHIP_TIERS.coach
const CAPTAIN_TIER = MEMBERSHIP_TIERS.captain
const LEAGUE_TIER = MEMBERSHIP_TIERS.league
const FULL_COURT_TIER = MEMBERSHIP_TIERS.full_court

export type CaptainSubscriptionStatus = 'inactive' | 'trial' | 'active' | 'past_due' | 'canceled'

export type ProductEntitlementSnapshot = {
  playerPlusSubscriptionActive: boolean
  playerPlusSubscriptionStatus: CaptainSubscriptionStatus
  coachSubscriptionActive?: boolean
  coachSubscriptionStatus?: CaptainSubscriptionStatus
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
  coachSubscriptionActive: boolean
  coachSubscriptionStatus: CaptainSubscriptionStatus
  captainSubscriptionActive: boolean
  captainSubscriptionStatus: CaptainSubscriptionStatus
  tiqTeamLeagueEntryEnabled: boolean
  tiqIndividualLeagueCreatorEnabled: boolean
  canUseAdvancedPlayerInsights: boolean
  canUsePlayerProjections: boolean
  canUseCoachWorkflow: boolean
  canUseCaptainWorkflow: boolean
  canUseLeagueTools: boolean
  canCreateTiqTeamLeague: boolean
  canEnterTiqTeamLeague: boolean
  canCreateTiqIndividualLeague: boolean
  canJoinTiqIndividualLeague: boolean
  playerPlusLabel: string
  playerPlusMessage: string
  coachTierLabel: string
  coachTierMessage: string
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
  coach_subscription_active?: boolean | null
  coach_subscription_status?: string | null
  captain_subscription_active?: boolean | null
  captain_subscription_status?: string | null
  tiq_team_league_entry_enabled?: boolean | null
  tiq_individual_league_creator_enabled?: boolean | null
}

const DEFAULT_ENTITLEMENTS: ProductEntitlementSnapshot = {
  playerPlusSubscriptionActive: false,
  playerPlusSubscriptionStatus: 'inactive',
  coachSubscriptionActive: false,
  coachSubscriptionStatus: 'inactive',
  captainSubscriptionActive: false,
  captainSubscriptionStatus: 'inactive',
  tiqTeamLeagueEntryEnabled: false,
  tiqIndividualLeagueCreatorEnabled: false,
}

export function normalizeSubscriptionStatus(value: string | null | undefined): CaptainSubscriptionStatus {
  if (value === 'trial') return 'trial'
  if (value === 'active') return 'active'
  if (value === 'past_due') return 'past_due'
  if (value === 'canceled') return 'canceled'
  return 'inactive'
}

function buildActivePlanIds({
  playerPlusActive,
  coachActive,
  captainActive,
  leagueToolsActive,
}: {
  playerPlusActive: boolean
  coachActive: boolean
  captainActive: boolean
  leagueToolsActive: boolean
}) {
  const planIds: PricingPlanId[] = ['free']

  if (playerPlusActive) {
    planIds.push('player_plus')
  }

  if (coachActive) {
    planIds.push('coach')
  }

  if (captainActive) {
    planIds.push('captain')
  }

  if (leagueToolsActive) {
    planIds.push('league')
  }

  if (playerPlusActive && coachActive && captainActive && leagueToolsActive) {
    planIds.push('full_court')
  }

  return planIds
}

export function hasPlanAccess(activePlanIds: PricingPlanId[], requiredPlanId: PricingPlanId) {
  if (requiredPlanId === 'free') return true
  if (requiredPlanId === 'player_plus') {
    return activePlanIds.includes('player_plus') || activePlanIds.includes('captain') || activePlanIds.includes('full_court')
  }

  if (requiredPlanId === 'captain') {
    return activePlanIds.includes('captain') || activePlanIds.includes('full_court')
  }

  if (requiredPlanId === 'coach') {
    return activePlanIds.includes('coach') || activePlanIds.includes('full_court')
  }

  if (requiredPlanId === 'league') {
    return activePlanIds.includes('league') || activePlanIds.includes('full_court')
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
    coachSubscriptionActive: false,
    coachSubscriptionStatus: 'inactive',
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
    playerPlusSubscriptionStatus: normalizeSubscriptionStatus(
      entitlements?.playerPlusSubscriptionStatus ?? fallback.playerPlusSubscriptionStatus,
    ),
    coachSubscriptionStatus: normalizeSubscriptionStatus(
      entitlements?.coachSubscriptionStatus ?? fallback.coachSubscriptionStatus,
    ),
    captainSubscriptionStatus: normalizeSubscriptionStatus(
      entitlements?.captainSubscriptionStatus ?? fallback.captainSubscriptionStatus,
    ),
  }

  const signedInMember = isMember(role)
  const captainSubscriptionActive = role === 'admin' || snapshot.captainSubscriptionActive
  const playerPlusActive = snapshot.playerPlusSubscriptionActive || snapshot.coachSubscriptionActive || captainSubscriptionActive
  const leagueToolsActive =
    role === 'admin' || snapshot.tiqTeamLeagueEntryEnabled || snapshot.tiqIndividualLeagueCreatorEnabled
  const fullCourtByCoreWorkspaces = playerPlusActive && captainSubscriptionActive && leagueToolsActive
  const coachSubscriptionActive = role === 'admin' || snapshot.coachSubscriptionActive || fullCourtByCoreWorkspaces

  const activePlanIds = buildActivePlanIds({
    playerPlusActive,
    coachActive: coachSubscriptionActive,
    captainActive: captainSubscriptionActive,
    leagueToolsActive,
  })

  const fullCourtActive = hasPlanAccess(activePlanIds, 'full_court')
  const currentPlanId: PricingPlanId = fullCourtActive
    ? 'full_court'
    : captainSubscriptionActive
      ? 'captain'
      : coachSubscriptionActive
        ? 'coach'
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
          : 'full_court'
        : leagueToolsActive
          ? null
        : signedInMember
          ? 'player_plus'
          : 'free'

  const canUseAdvancedPlayerInsights = hasPlanAccess(activePlanIds, 'player_plus')
  const canUsePlayerProjections = hasPlanAccess(activePlanIds, 'player_plus')
  const canUseCoachWorkflow = hasPlanAccess(activePlanIds, 'coach')
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
    coachSubscriptionActive,
    coachSubscriptionStatus: snapshot.coachSubscriptionStatus ?? 'inactive',
    canUseAdvancedPlayerInsights,
    canUsePlayerProjections,
    canUseCoachWorkflow,
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
    coachTierLabel: coachSubscriptionActive
      ? `${COACH_TIER.name} active`
      : `${COACH_TIER.name} - ${COACH_SUBSCRIPTION_PRICE_LABEL}`,
    coachTierMessage: coachSubscriptionActive
      ? `${COACH_TIER.name} tools are active. ${COACH_TIER.description}`
      : COACH_TIER.description,
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
      ? `${fullCourtActive ? FULL_COURT_TIER.name : LEAGUE_TIER.name} tools are active. Create team leagues, structure participants, and keep competition inside TIQ.`
      : `${LEAGUE_TIER.upgradeCue} Team leagues keep teams, season flow, and competition work together.`,
    individualLeagueMessage: canCreateTiqIndividualLeague
      ? `${fullCourtActive ? FULL_COURT_TIER.name : LEAGUE_TIER.name} tools are active. Create the competition container, organize players, and keep standings out of spreadsheets.`
      : `${LEAGUE_TIER.upgradeCue} Individual leagues can start without forcing every player into a subscription.`,
  }
}

export function shouldShowSponsoredPlacements(access: ProductAccessState) {
  return !access.canUseAdvancedPlayerInsights && !access.canUseCoachWorkflow && !access.canUseCaptainWorkflow && !access.canUseLeagueTools
}

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
