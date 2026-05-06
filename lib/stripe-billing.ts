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

function isCompletePaidCheckoutSession(session: StripeBillingCheckoutSession) {
  return (
    session.status === 'complete' &&
    (session.payment_status === 'paid' || session.payment_status === 'no_payment_required')
  )
}
