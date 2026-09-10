import { describe, expect, it } from 'vitest'
import {
  buildCaptainPilotFollowUps,
  buildCaptainPilotFunnel,
  type GrowthEventRow,
} from '@/lib/admin-growth-funnel'

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

  it('surfaces checkout errors immediately and waits a day before labeling other claims as stalled', () => {
    const now = Date.parse('2026-09-10T18:00:00.000Z')
    const followUps = buildCaptainPilotFollowUps([
      event('captain-error', 'upgrade_checkout_failed', { plan_id: 'captain', metadata: { source: 'captain_pilot' } }),
      event('other-error', 'upgrade_checkout_failed', { plan_id: 'captain', metadata: { source: 'upgrade' } }),
    ], [
      { profile_id: 'captain-error', status: 'claimed', captain_name: 'Casey Error', captain_email: 'casey@example.com', team_name: 'Aces', updated_at: '2026-09-10T17:55:00.000Z' },
      { profile_id: 'captain-new', status: 'claimed', captain_name: 'New Captain', updated_at: '2026-09-10T12:00:00.000Z' },
      { profile_id: 'captain-waiting', status: 'checkout_started', captain_name: 'Jamie Waiting', team_name: 'Topspin', updated_at: '2026-09-08T18:00:00.000Z' },
      { profile_id: 'captain-active', status: 'converted', captain_name: 'Already Active', updated_at: '2026-09-01T18:00:00.000Z' },
    ], now)

    expect(followUps).toEqual([
      expect.objectContaining({ profileId: 'captain-error', urgent: true, waitingDays: 0 }),
      expect.objectContaining({ profileId: 'captain-waiting', urgent: false, waitingDays: 2 }),
    ])
  })
})
