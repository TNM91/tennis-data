import { describe, expect, it } from 'vitest'
import { buildCaptainPilotFunnel, type GrowthEventRow } from '@/lib/admin-growth-funnel'

const event = (
  userId: string,
  eventName: string,
  overrides: Partial<GrowthEventRow> = {},
): GrowthEventRow => ({
  user_id: userId,
  event_name: eventName,
  plan_id: null,
  metadata: {},
  ...overrides,
})

describe('Captain Pilot growth funnel', () => {
  it('deduplicates identified members and keeps the pilot tour scoped to its source', () => {
    const funnel = buildCaptainPilotFunnel([
      event('captain-1', 'captain_pilot_viewed'),
      event('captain-1', 'captain_pilot_viewed'),
      event('captain-1', 'product_tour_started', { metadata: { videoId: 'captain', source: 'captain-pilot' } }),
      event('captain-2', 'product_tour_started', { metadata: { videoId: 'captain', source: 'pricing' } }),
      event('captain-3', 'signup_confirmation_sent', { plan_id: 'captain', metadata: { signup_intent: 'captain-pilot' } }),
      event('captain-4', 'signup_confirmation_sent', { plan_id: 'captain', metadata: { signup_intent: 'captain' } }),
      event('captain-1', 'captain_pilot_cta_clicked'),
      event('captain-1', 'upgrade_checkout_failed', { plan_id: 'captain', metadata: { source: 'captain_pilot' } }),
    ], [
      { profile_id: 'captain-1', status: 'converted' },
      { profile_id: 'captain-1', status: 'converted' },
      { profile_id: 'captain-5', status: 'claimed' },
    ])

    expect(funnel).toEqual({
      offerViews: 1,
      tourStarts: 1,
      signupRequests: 1,
      offerActions: 1,
      claims: 2,
      checkoutStarts: 1,
      checkoutFailures: 1,
      activations: 1,
    })
  })
})
