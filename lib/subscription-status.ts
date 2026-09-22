export type SubscriptionStatus = 'inactive' | 'trial' | 'active' | 'past_due' | 'canceled'

/**
 * Server-safe normalization for persisted subscription values.
 *
 * Keep this independent of client product modules: auth routes run before the
 * app shell and must never cross a Client Component module boundary.
 */
export function normalizeSubscriptionStatus(value: string | null | undefined): SubscriptionStatus {
  if (value === 'trial') return 'trial'
  if (value === 'active') return 'active'
  if (value === 'past_due') return 'past_due'
  if (value === 'canceled') return 'canceled'
  return 'inactive'
}
