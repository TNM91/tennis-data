import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaidPricingPlanId } from './stripe-checkout'
import {
  getTeamInviteOfferAcceptedSince,
  resolveTeamInviteOffer,
  type TeamInviteOffers,
} from './team-invite-offers-core'

type SupportedInvitePlanId = Extract<PaidPricingPlanId, 'captain' | 'player_plus'>

const OFFER_CONFIG = {
  captain: {
    couponEnv: 'STRIPE_CAPTAIN_TEAM_INVITE_COUPON_ID',
    labelEnv: 'CAPTAIN_TEAM_INVITE_OFFER_LABEL',
    defaultLabel: 'First month $4.99, then $9.99/month',
    roles: ['captain', 'co_captain'],
    entitlementSelect: 'captain_subscription_active,captain_subscription_status',
    activeFields: ['captain_subscription_active'],
    statusFields: ['captain_subscription_status'],
    priorPlanIds: ['captain', 'full_court'],
  },
  player_plus: {
    couponEnv: 'STRIPE_PLAYER_TEAM_INVITE_COUPON_ID',
    labelEnv: 'PLAYER_TEAM_INVITE_OFFER_LABEL',
    defaultLabel: 'First month $2.49, then $4.99/month',
    roles: ['player'],
    entitlementSelect:
      'player_plus_subscription_active,player_plus_subscription_status,coach_subscription_active,coach_subscription_status,captain_subscription_active,captain_subscription_status',
    activeFields: [
      'player_plus_subscription_active',
      'coach_subscription_active',
      'captain_subscription_active',
    ],
    statusFields: [
      'player_plus_subscription_status',
      'coach_subscription_status',
      'captain_subscription_status',
    ],
    priorPlanIds: ['player_plus', 'coach', 'captain', 'full_court'],
  },
} as const

export async function getTeamInviteOfferEligibility(
  supabase: SupabaseClient,
  userId: string,
  planId: SupportedInvitePlanId,
  env: Record<string, string | undefined> = process.env,
) {
  const config = OFFER_CONFIG[planId]
  const couponId = env[config.couponEnv]?.trim() ?? ''
  const label = env[config.labelEnv]?.trim() || config.defaultLabel
  if (!couponId) return { available: false, label: '', couponId: '' }

  const acceptedSince = getTeamInviteOfferAcceptedSince()
  const [{ data: profile, error: profileError }, linkResult, billingResult] = await Promise.all([
    supabase
      .from('profiles')
      .select(config.entitlementSelect)
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('team_profile_links')
      .select('team_role,team_roles,role_accepted_at,accepted_at')
      .eq('profile_user_id', userId)
      .eq('status', 'accepted'),
    supabase
      .from('stripe_billing_events')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', userId)
      .eq('outcome', 'handled')
      .in('plan_id', [...config.priorPlanIds]),
  ])

  if (profileError || linkResult.error || billingResult.error) {
    return { available: false, label: '', couponId: '' }
  }

  const entitlement = (profile || {}) as Record<string, boolean | string | null | undefined>
  const hasActiveAccess =
    config.activeFields.some((field) => entitlement[field] === true) ||
    config.statusFields.some((field) => entitlement[field] === 'active' || entitlement[field] === 'trial')
  const acceptedSinceMs = Date.parse(acceptedSince)
  const hasRecentAcceptedLink = ((linkResult.data || []) as Array<{
    team_role?: string | null
    team_roles?: string[] | null
    role_accepted_at?: Record<string, unknown> | null
    accepted_at?: string | null
  }>).some((link) => config.roles.some((role) => {
    const roles = link.team_roles?.length ? link.team_roles : [link.team_role || 'player']
    if (!roles.includes(role)) return false
    const acceptedAt = link.role_accepted_at?.[role] || (link.team_role === role ? link.accepted_at : null)
    return typeof acceptedAt === 'string' && Date.parse(acceptedAt) >= acceptedSinceMs
  }))
  const hasPriorSubscription = Boolean(billingResult.count)
  return resolveTeamInviteOffer({
    couponId,
    label,
    hasActiveAccess,
    hasRecentAcceptedLink,
    hasPriorSubscription,
  })
}

export async function getPublicTeamInviteOffers(supabase: SupabaseClient, userId: string): Promise<TeamInviteOffers> {
  const [captain, player] = await Promise.all([
    getTeamInviteOfferEligibility(supabase, userId, 'captain'),
    getTeamInviteOfferEligibility(supabase, userId, 'player_plus'),
  ])
  return {
    captain: { available: captain.available, label: captain.label },
    player: { available: player.available, label: player.label },
  }
}
