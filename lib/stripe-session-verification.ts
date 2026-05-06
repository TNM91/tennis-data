export type StripeCheckoutCompletionSession = {
  id?: string
  status?: string | null
  payment_status?: string | null
  client_reference_id?: string | null
  customer?: string | { id?: string | null } | null
  customer_email?: string | null
  subscription?: string | { id?: string | null } | null
  metadata?: Record<string, string | undefined> | null
}

export type StripeCheckoutCompletionTarget = {
  requestId: string
  userId: string
}

export function isPaidStripeCheckoutSessionForRequest(
  session: StripeCheckoutCompletionSession | null | undefined,
  target: StripeCheckoutCompletionTarget,
) {
  if (!session?.id) return false
  if (session.status !== 'complete') return false
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return false

  const metadataRequestId = session.metadata?.upgrade_request_id?.trim()
  const metadataUserId = session.metadata?.user_id?.trim()

  return (
    (session.client_reference_id === target.requestId || metadataRequestId === target.requestId) &&
    metadataUserId === target.userId
  )
}

export function findPaidStripeCheckoutSessionForRequest(
  sessions: StripeCheckoutCompletionSession[],
  target: StripeCheckoutCompletionTarget,
) {
  return sessions.find((session) => isPaidStripeCheckoutSessionForRequest(session, target)) ?? null
}
