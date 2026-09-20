import { summarizeAccountTiers, type AccountTierRow } from './admin-account-tiers'
import { getPricingPlan, type BillablePricingPlanId, type PricingPlanId } from './pricing-plans'
import type { StripeRevenueReport, StripeRevenueTrend } from './stripe-revenue-report'

export type SubscriptionTrendPoint = {
  month: string
  label: string
  newPaidAccounts: number
  cancellations: number
}

export type BusinessPulseProfileRow = AccountTierRow & { id?: string | null }

export type BusinessPulseClubRow = {
  owner_user_id?: string | null
  plan_id?: string | null
  status?: string | null
  stripe_subscription_id?: string | null
}

export type BusinessPulseEventRow = {
  stripe_event_id?: string | null
  event_type?: string | null
  outcome?: string | null
  profile_id?: string | null
  stripe_subscription_id?: string | null
  plan_id?: string | null
  resulting_status?: string | null
  created_at?: string | null
}

export type BusinessPulse = {
  estimatedMrrCents: number
  activePaidSubscriptions: number
  newPaidAccounts30d: number
  cancellations30d: number
  recordedTrials: number
  trialConversions: number
  trialConversionRate: number | null
  stripeRevenue30d: StripeRevenueReport | null
  stripeRevenueTrend6m: StripeRevenueTrend | null
  stripeRevenueMessage: string | null
  subscriptionTrend6m: SubscriptionTrendPoint[]
  asOf: string
}

const MONTHLY_CORE_PLANS: PricingPlanId[] = ['player_plus', 'coach', 'captain', 'full_court']

export function buildBusinessPulse({
  profiles,
  clubs,
  events,
  now = Date.now(),
}: {
  profiles: BusinessPulseProfileRow[]
  clubs: BusinessPulseClubRow[]
  events: BusinessPulseEventRow[]
  now?: number
}): BusinessPulse {
  const tierSummary = summarizeAccountTiers(profiles, now)
  let estimatedMrrCents = 0
  let activePaidSubscriptions = 0

  for (const planId of MONTHLY_CORE_PLANS) {
    const count = tierSummary.healthByTier[planId].paid
    estimatedMrrCents += count * getPricingPlan(planId).billing.amountCents
    activePaidSubscriptions += count
  }

  for (const club of clubs) {
    if (club.status !== 'active' || !club.stripe_subscription_id) continue
    const planId = normalizeBillablePlanId(club.plan_id)
    if (!planId) continue
    const plan = getPricingPlan(planId)
    if (plan.billing.interval !== 'month') continue
    estimatedMrrCents += plan.billing.amountCents
    activePaidSubscriptions += 1
  }

  const handledEvents = events
    .filter((event) => event.outcome === 'handled')
    .map((event) => ({ ...event, timestamp: Date.parse(event.created_at ?? '') }))
    .filter((event) => Number.isFinite(event.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp)
  const since30d = now - 30 * 24 * 60 * 60 * 1000
  const firstActiveBySubscription = new Map<string, number>()
  const canceledSubscriptions = new Set<string>()
  const firstCancellationBySubscription = new Map<string, number>()
  const trialStartedAt = new Map<string, number>()
  const convertedTrials = new Set<string>()

  for (const event of handledEvents) {
    const key = billingEventAccountKey(event)
    if (!key) continue

    if (event.resulting_status === 'trial' && !trialStartedAt.has(key)) {
      trialStartedAt.set(key, event.timestamp)
    }
    if (event.resulting_status === 'active') {
      if (!firstActiveBySubscription.has(key)) firstActiveBySubscription.set(key, event.timestamp)
      const trialAt = trialStartedAt.get(key)
      if (trialAt != null && event.timestamp >= trialAt) convertedTrials.add(key)
    }
    if (
      (event.resulting_status === 'canceled' || event.event_type === 'customer.subscription.deleted')
    ) {
      if (!firstCancellationBySubscription.has(key)) firstCancellationBySubscription.set(key, event.timestamp)
      if (event.timestamp >= since30d) canceledSubscriptions.add(key)
    }
  }

  const newPaidAccounts30d = [...firstActiveBySubscription.values()].filter((timestamp) => timestamp >= since30d).length
  const recordedTrials = trialStartedAt.size
  const trialConversions = convertedTrials.size
  const subscriptionTrend6m = buildSubscriptionTrend6m(
    firstActiveBySubscription,
    firstCancellationBySubscription,
    now,
  )

  return {
    estimatedMrrCents,
    activePaidSubscriptions,
    newPaidAccounts30d,
    cancellations30d: canceledSubscriptions.size,
    recordedTrials,
    trialConversions,
    trialConversionRate: recordedTrials > 0 ? trialConversions / recordedTrials : null,
    stripeRevenue30d: null,
    stripeRevenueTrend6m: null,
    stripeRevenueMessage: null,
    subscriptionTrend6m,
    asOf: new Date(now).toISOString(),
  }
}

function buildSubscriptionTrend6m(
  activeBySubscription: Map<string, number>,
  canceledBySubscription: Map<string, number>,
  now: number,
): SubscriptionTrendPoint[] {
  const nowDate = new Date(now)
  return Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - 5 + index, 1))
    const month = monthDate.toISOString().slice(0, 7)
    const isMonth = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 7) === month
    return {
      month,
      label: monthDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      newPaidAccounts: [...activeBySubscription.values()].filter(isMonth).length,
      cancellations: [...canceledBySubscription.values()].filter(isMonth).length,
    }
  })
}

function billingEventAccountKey(event: BusinessPulseEventRow) {
  return event.stripe_subscription_id?.trim() || event.profile_id?.trim() || event.stripe_event_id?.trim() || ''
}

function normalizeBillablePlanId(value: string | null | undefined): BillablePricingPlanId | null {
  if (
    value === 'free' ||
    value === 'player_plus' ||
    value === 'coach' ||
    value === 'captain' ||
    value === 'league' ||
    value === 'full_court' ||
    value === 'club_starter' ||
    value === 'club_unlimited'
  ) {
    return value
  }
  return null
}
