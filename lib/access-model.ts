'use client'

import { supabase } from '@/lib/supabase'
import { isCaptain, isMember, type UserRole } from '@/lib/roles'
import { getPricingPlan, type PricingPlanId } from '@/lib/pricing-plans'

export const CAPTAIN_SUBSCRIPTION_PRICE_LABEL = getPricingPlan('captain').priceLabel
export const PLAYER_PLUS_PRICE_LABEL = getPricingPlan('player_plus').priceLabel
export const LEAGUE_PRICE_LABEL = getPricingPlan('league').priceLabel
export const TIQ_SEASON_FEE_PRICE_LABEL = '$10/season'

export type CaptainSubscriptionStatus = 'inactive' | 'trial' | 'active' | 'past_due' | 'canceled'

export type ProductEntitlementSnapshot = {
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
  captain_subscription_active?: boolean | null
  captain_subscription_status?: string | null
  tiq_team_league_entry_enabled?: boolean | null
  tiq_individual_league_creator_enabled?: boolean | null
}

const DEFAULT_ENTITLEMENTS: ProductEntitlementSnapshot = {
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
    captainSubscriptionStatus: normalizeCaptainSubscriptionStatus(
      entitlements?.captainSubscriptionStatus ?? fallback.captainSubscriptionStatus,
    ),
  }

  const signedInMember = isMember(role)
  const captainSubscriptionActive = snapshot.captainSubscriptionActive
  const playerPlusActive = captainSubscriptionActive || role === 'admin'
  const leagueToolsActive =
    role === 'admin' || snapshot.tiqTeamLeagueEntryEnabled || snapshot.tiqIndividualLeagueCreatorEnabled

  const activePlanIds = buildActivePlanIds({
    playerPlusActive,
    captainActive: captainSubscriptionActive,
    leagueToolsActive,
  })

  const currentPlanId: PricingPlanId = captainSubscriptionActive
    ? 'captain'
    : playerPlusActive
      ? 'player_plus'
      : leagueToolsActive
        ? 'league'
        : 'free'

  const recommendedUpgradePlanId: PricingPlanId | null =
    role === 'admin'
      ? null
      : isCaptain(role)
        ? leagueToolsActive
          ? null
          : 'league'
        : signedInMember
          ? 'player_plus'
          : 'free'

  const canUseAdvancedPlayerInsights = hasPlanAccess(activePlanIds, 'player_plus')
  const canUsePlayerProjections = hasPlanAccess(activePlanIds, 'player_plus')
  const canUseCaptainWorkflow = hasPlanAccess(activePlanIds, 'captain')
  const canUseLeagueTools = hasPlanAccess(activePlanIds, 'league')
  const canCreateTiqTeamLeague = canUseLeagueTools
  const canEnterTiqTeamLeague = canUseCaptainWorkflow && snapshot.tiqTeamLeagueEntryEnabled
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
      ? `Player+ active - ${PLAYER_PLUS_PRICE_LABEL}`
      : `Player+ - ${PLAYER_PLUS_PRICE_LABEL}`,
    playerPlusMessage: playerPlusActive
      ? 'Player+ analytics are active for personal improvement, lineup-fit guidance, opponent insight, and match projections.'
      : 'Player+ helps players see where they should play, understand strengths and weaknesses faster, and make smarter match decisions.',
    captainTierLabel: captainSubscriptionActive
      ? `Captain ${captainTierStatusLabel} - ${CAPTAIN_SUBSCRIPTION_PRICE_LABEL}`
      : `Captain - ${CAPTAIN_SUBSCRIPTION_PRICE_LABEL}`,
    captainTierMessage: captainSubscriptionActive
      ? 'Captain tools are active for lineup building, scenario planning, projections, team messaging, and weekly match-day execution.'
      : 'Still building lineups manually? Captain turns availability, lineup decisions, projections, and communication into one weekly workflow.',
    leagueTierLabel: canUseLeagueTools
      ? `League tools active - ${LEAGUE_PRICE_LABEL}`
      : `League - ${LEAGUE_PRICE_LABEL}`,
    leagueTierMessage: canUseLeagueTools
      ? 'League tools are active for TIQ season setup, scheduling, standings, and organizer workflows.'
      : 'Ready to run your league without spreadsheets? League tools give organizers one place for structure, visibility, and communication.',
    teamLeagueMessage: canEnterTiqTeamLeague
      ? 'Team-league tools are active. Add your team, manage the season cleanly, and keep weekly competition inside TIQ.'
      : `Captain plus League is the clean path for organized team play: unlock captain tools, then run each league season for ${TIQ_SEASON_FEE_PRICE_LABEL}.`,
    individualLeagueMessage: canCreateTiqIndividualLeague
      ? 'Individual-league tools are active. Create the competition container, organize players, and keep standings out of spreadsheets.'
      : `League tools make it easy to launch individual TIQ competition for ${TIQ_SEASON_FEE_PRICE_LABEL} without forcing every player into a subscription.`,
  }
}

export async function getClientEntitlementSnapshot(
  userId: string | null | undefined,
): Promise<ProductEntitlementSnapshot | null> {
  if (!userId) return null

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'captain_subscription_active, captain_subscription_status, tiq_team_league_entry_enabled, tiq_individual_league_creator_enabled',
      )
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error

    const row = (data || null) as ProductEntitlementRow | null
    if (!row) return null

    return {
      captainSubscriptionActive: Boolean(row.captain_subscription_active),
      captainSubscriptionStatus: normalizeCaptainSubscriptionStatus(row.captain_subscription_status),
      tiqTeamLeagueEntryEnabled: Boolean(row.tiq_team_league_entry_enabled),
      tiqIndividualLeagueCreatorEnabled: Boolean(row.tiq_individual_league_creator_enabled),
    }
  } catch {
    return null
  }
}
