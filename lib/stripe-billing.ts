import type { PaidPricingPlanId } from './stripe-checkout'

export type StripeObjectReference = string | { id?: string | null } | null | undefined

export type StripeBillingCheckoutSession = {
  id?: string | null
  status?: string | null
  payment_status?: string | null
  customer?: StripeObjectReference
  customer_email?: string | null
  subscription?: StripeObjectReference
  metadata?: Record<string, string | undefined> | null
}

export type StripeBillingCustomerTarget = {
  userId: string
  email?: string
}

export type StripeSubscriptionLifecycleObject = {
  id?: string | null
  status?: string | null
  customer?: StripeObjectReference
  subscription?: StripeObjectReference
  metadata?: Record<string, string | undefined> | null
  subscription_details?: {
    metadata?: Record<string, string | undefined> | null
  } | null
  parent?: {
    subscription_details?: {
      metadata?: Record<string, string | undefined> | null
    } | null
  } | null
}

export type StripeSubscriptionLifecycleEvent = {
  type?: string
  data?: {
    object?: StripeSubscriptionLifecycleObject
  }
}

export type StripeSubscriptionProfileUpdate = {
  userId: string
  subscriptionId: string
  customerId: string
  planId: SubscriptionPricingPlanId
  payload: Record<string, boolean | string>
}

export const STRIPE_SUBSCRIPTION_LIFECYCLE_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
] as const

type SubscriptionPricingPlanId = Extract<PaidPricingPlanId, 'player_plus' | 'captain'>
type SubscriptionEntitlementStatus = 'inactive' | 'trial' | 'active' | 'past_due' | 'canceled'

export function getStripeObjectId(value: StripeObjectReference) {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value.id === 'string') return value.id.trim()
  return ''
}

export function buildStripeBillingProfilePayload(session: StripeBillingCheckoutSession | null | undefined) {
  const customerId = getStripeObjectId(session?.customer)
  const subscriptionId = getStripeObjectId(session?.subscription)
  const payload: Record<string, string> = {}

  if (customerId) {
    payload.stripe_customer_id = customerId
  }

  if (subscriptionId) {
    payload.stripe_subscription_id = subscriptionId
  }

  return payload
}

export function isStripeSubscriptionLifecycleEvent(event: StripeSubscriptionLifecycleEvent) {
  return STRIPE_SUBSCRIPTION_LIFECYCLE_EVENTS.includes(
    event.type as (typeof STRIPE_SUBSCRIPTION_LIFECYCLE_EVENTS)[number],
  )
}

export function buildStripeSubscriptionProfileUpdate(
  event: StripeSubscriptionLifecycleEvent,
): StripeSubscriptionProfileUpdate | null {
  if (!isStripeSubscriptionLifecycleEvent(event)) return null

  const object = event.data?.object
  if (!object) return null

  const metadata = getStripeSubscriptionMetadata(object)
  const planId = normalizeSubscriptionPricingPlanId(metadata.plan_id)
  if (!planId) return null

  const userId = metadata.user_id?.trim() ?? ''
  const subscriptionId =
    event.type === 'invoice.payment_failed'
      ? getStripeObjectId(object.subscription)
      : getStripeObjectId(object)
  const customerId = getStripeObjectId(object.customer)

  if (!userId && !subscriptionId && !customerId) return null

  const payload = buildSubscriptionEntitlementPayload(planId, resolveSubscriptionStatus(event))
  if (customerId) {
    payload.stripe_customer_id = customerId
  }
  if (subscriptionId) {
    payload.stripe_subscription_id = subscriptionId
  }

  return {
    userId,
    subscriptionId,
    customerId,
    planId,
    payload,
  }
}

export function removeStripeBillingProfileFields<T extends Record<string, unknown>>(payload: T) {
  const rest = { ...payload }
  delete rest.stripe_customer_id
  delete rest.stripe_subscription_id
  return rest
}

export function isStripeBillingProfileColumnError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? ''
  return (
    error?.code === 'PGRST204' ||
    message.includes('stripe_customer_id') ||
    message.includes('stripe_subscription_id') ||
    message.includes('schema cache')
  )
}

export function findStripeCustomerIdForUser(
  sessions: StripeBillingCheckoutSession[],
  target: StripeBillingCustomerTarget,
) {
  const normalizedEmail = target.email?.trim().toLowerCase() ?? ''

  for (const session of sessions) {
    const customerId = getStripeObjectId(session.customer)
    if (!customerId || !isCompletePaidCheckoutSession(session)) continue

    const metadataUserId = session.metadata?.user_id?.trim()
    if (metadataUserId && metadataUserId === target.userId) {
      return customerId
    }

    const sessionEmail = session.customer_email?.trim().toLowerCase()
    if (normalizedEmail && sessionEmail === normalizedEmail) {
      return customerId
    }
  }

  return ''
}

function getStripeSubscriptionMetadata(object: StripeSubscriptionLifecycleObject) {
  return {
    ...object.parent?.subscription_details?.metadata,
    ...object.subscription_details?.metadata,
    ...object.metadata,
  }
}

function normalizeSubscriptionPricingPlanId(value: string | undefined) {
  return value === 'player_plus' || value === 'captain' ? value : null
}

function resolveSubscriptionStatus(event: StripeSubscriptionLifecycleEvent): SubscriptionEntitlementStatus {
  if (event.type === 'customer.subscription.deleted') return 'canceled'
  if (event.type === 'invoice.payment_failed') return 'past_due'

  const status = event.data?.object?.status
  if (status === 'trialing') return 'trial'
  if (status === 'active') return 'active'
  if (status === 'past_due' || status === 'unpaid') return 'past_due'
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled'
  return 'inactive'
}

function buildSubscriptionEntitlementPayload(
  planId: SubscriptionPricingPlanId,
  status: SubscriptionEntitlementStatus,
) {
  const active = status === 'active' || status === 'trial'
  const payload: Record<string, boolean | string> = {
    player_plus_subscription_active: active,
    player_plus_subscription_status: status,
  }

  if (planId === 'captain') {
    payload.captain_subscription_active = active
    payload.captain_subscription_status = status
  }

  return payload
}

function isCompletePaidCheckoutSession(session: StripeBillingCheckoutSession) {
  return (
    session.status === 'complete' &&
    (session.payment_status === 'paid' || session.payment_status === 'no_payment_required')
  )
}
