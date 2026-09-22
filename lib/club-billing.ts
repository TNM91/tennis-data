import type { ClubPricingPlanId } from './pricing-plans'
import { getStripeObjectId, type StripeBillingCheckoutSession, type StripeSubscriptionLifecycleEvent } from './stripe-billing'

export type ClubBillingStatus = 'inactive' | 'trial' | 'active' | 'past_due' | 'canceled'

export type ClubBillingAccount = {
  ownerUserId: string
  planId: ClubPricingPlanId
  status: ClubBillingStatus
  stripeCustomerId: string
  stripeSubscriptionId: string
}

export type ClubBillingAccountPayload = {
  owner_user_id: string
  plan_id: ClubPricingPlanId
  status: ClubBillingStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

export function isClubPricingPlanId(value: unknown): value is ClubPricingPlanId {
  return value === 'club_starter' || value === 'club_unlimited'
}

export function isActiveClubBillingStatus(value: unknown) {
  return value === 'active' || value === 'trial'
}

export function buildClubBillingCheckoutPayload(
  session: StripeBillingCheckoutSession | null | undefined,
  ownerUserId: string,
  planId: ClubPricingPlanId,
): ClubBillingAccountPayload {
  return {
    owner_user_id: ownerUserId,
    plan_id: planId,
    status: 'active',
    stripe_customer_id: getStripeObjectId(session?.customer) || null,
    stripe_subscription_id: getStripeObjectId(session?.subscription) || null,
  }
}

export function buildClubBillingSubscriptionUpdate(
  event: StripeSubscriptionLifecycleEvent,
): ClubBillingAccountPayload | null {
  const object = event.data?.object
  if (!object) return null

  const metadata = {
    ...object.parent?.subscription_details?.metadata,
    ...object.subscription_details?.metadata,
    ...object.metadata,
  }
  if (!isClubPricingPlanId(metadata.plan_id)) return null

  const ownerUserId = metadata.user_id?.trim() ?? ''
  if (!ownerUserId) return null

  const subscriptionId = event.type === 'invoice.payment_failed'
    ? getStripeObjectId(object.subscription)
    : getStripeObjectId(object)

  return {
    owner_user_id: ownerUserId,
    plan_id: metadata.plan_id,
    status: resolveClubBillingStatus(event),
    stripe_customer_id: getStripeObjectId(object.customer) || null,
    stripe_subscription_id: subscriptionId || null,
  }
}

export function mapClubBillingAccountRow(row: Record<string, unknown> | null | undefined): ClubBillingAccount | null {
  if (!row || !isClubPricingPlanId(row.plan_id)) return null
  const ownerUserId = clean(row.owner_user_id)
  if (!ownerUserId) return null

  return {
    ownerUserId,
    planId: row.plan_id,
    status: normalizeClubBillingStatus(row.status),
    stripeCustomerId: clean(row.stripe_customer_id),
    stripeSubscriptionId: clean(row.stripe_subscription_id),
  }
}

function resolveClubBillingStatus(event: StripeSubscriptionLifecycleEvent): ClubBillingStatus {
  if (event.type === 'customer.subscription.deleted') return 'canceled'
  if (event.type === 'invoice.payment_failed') return 'past_due'

  const status = event.data?.object?.status
  if (status === 'trialing') return 'trial'
  if (status === 'active') return 'active'
  if (status === 'past_due' || status === 'unpaid') return 'past_due'
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled'
  return 'inactive'
}

function normalizeClubBillingStatus(value: unknown): ClubBillingStatus {
  return value === 'trial' || value === 'active' || value === 'past_due' || value === 'canceled'
    ? value
    : 'inactive'
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
