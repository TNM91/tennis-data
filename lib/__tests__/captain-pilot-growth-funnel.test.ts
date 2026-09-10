import { describe, expect, it } from 'vitest'
import {
  buildCaptainPilotActivation,
  buildCaptainPilotActivationFollowUps,
  buildCaptainPilotFollowUps,
  buildCaptainPilotFunnel,
  buildCaptainPilotSourceBreakdown,
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
      { profile_id: 'captain-1', status: 'converted', billing_status: 'collected' },
      { profile_id: 'captain-1', status: 'converted', billing_status: 'collected' },
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
      billingConnected: 1,
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

  it('attributes each captain to the first known outreach source through activation', () => {
    const sources = buildCaptainPilotSourceBreakdown([
      event('text-captain', 'captain_pilot_viewed', { metadata: { acquisitionSource: 'text' }, created_at: '2026-09-01T12:00:00Z' }),
      event('text-captain', 'signup_confirmation_sent', { plan_id: 'captain', metadata: { signup_intent: 'captain-pilot', acquisitionSource: 'text' }, created_at: '2026-09-01T12:05:00Z' }),
      event('flyer-captain', 'signup_confirmation_sent', { plan_id: 'captain', metadata: { signup_intent: 'captain-pilot', acquisitionSource: 'club-flyer' }, created_at: '2026-09-02T12:00:00Z' }),
      event('referred-captain', 'captain_pilot_viewed', { metadata: {}, created_at: '2026-09-03T12:00:00Z' }),
      event('referred-captain', 'captain_pilot_claimed', { metadata: { acquisitionSource: 'referral' }, created_at: '2026-09-03T12:05:00Z' }),
    ], [
      { profile_id: 'text-captain', status: 'converted', billing_status: 'collected' },
      { profile_id: 'flyer-captain', status: 'claimed' },
      { profile_id: 'referred-captain', status: 'converted' },
      { profile_id: 'persisted-email-captain', status: 'converted', acquisition_source: 'email' },
      { profile_id: 'direct-captain', status: 'claimed', acquisition_source: 'direct' },
    ])

    expect(sources.find((source) => source.source === 'text')).toMatchObject({ offerViews: 1, signupRequests: 1, claims: 1, activations: 1, billingConnected: 1 })
    expect(sources.find((source) => source.source === 'flyer')).toMatchObject({ offerViews: 0, signupRequests: 1, claims: 1, activations: 0 })
    expect(sources.find((source) => source.source === 'referral')).toMatchObject({ offerViews: 1, claims: 1, activations: 1 })
    expect(sources.find((source) => source.source === 'email')).toMatchObject({ claims: 1, activations: 1 })
    expect(sources.find((source) => source.source === 'direct')).toMatchObject({ claims: 1, activations: 0 })
  })

  it('counts real post-activation Captain work without treating empty drafts as first value', () => {
    const activation = buildCaptainPilotActivation(
      ['active-one', 'active-two', 'active-three'],
      [
        { profile_user_id: 'active-one', team_role: 'captain' },
        { profile_user_id: 'active-one', team_roles: ['player', 'captain'] },
        { profile_user_id: 'active-two', team_role: 'co_captain' },
        { profile_user_id: 'active-three', team_role: 'player' },
        { profile_user_id: 'not-in-pilot', team_role: 'captain' },
      ],
      [
        { user_id: 'active-one', slots_json: [{ players: [{ playerId: 'player-1', playerName: 'Player One' }] }] },
        { user_id: 'active-two', slots_json: [{ players: [{ playerId: '', playerName: '' }] }] },
        { user_id: 'not-in-pilot', slots_json: [{ players: [{ playerName: 'Other Player' }] }] },
      ],
      [
        { created_by: 'active-two' },
        { created_by: 'active-two' },
        { created_by: 'not-in-pilot' },
      ],
    )

    expect(activation).toEqual({
      activations: 3,
      teamConnected: 2,
      lineupStarted: 1,
      availabilitySent: 1,
      firstValue: 2,
    })
  })

  it('adds tailored onboarding follow-up only after an active captain stalls for a day', () => {
    const now = Date.parse('2026-09-10T18:00:00.000Z')
    const followUps = buildCaptainPilotActivationFollowUps([
      { profile_id: 'needs-team', status: 'converted', captain_name: 'Taylor Team', converted_at: '2026-09-08T18:00:00.000Z' },
      { profile_id: 'needs-week', status: 'converted', captain_name: 'Wes Week', converted_at: '2026-09-08T18:00:00.000Z' },
      { profile_id: 'new-active', status: 'converted', captain_name: 'New Active', converted_at: '2026-09-10T12:00:00.000Z' },
      { profile_id: 'has-value', status: 'converted', captain_name: 'Ready Captain', converted_at: '2026-09-01T18:00:00.000Z' },
    ], [
      { profile_user_id: 'needs-week', team_role: 'captain' },
      { profile_user_id: 'new-active', team_role: 'captain' },
      { profile_user_id: 'has-value', team_role: 'co_captain' },
    ], [
      { user_id: 'has-value', slots_json: [{ players: [{ playerName: 'Player One' }] }] },
    ], [], now)

    expect(followUps).toEqual([
      expect.objectContaining({ profileId: 'needs-team', stage: 'team_connection', waitingDays: 2 }),
      expect.objectContaining({ profileId: 'needs-week', stage: 'first_week', waitingDays: 2 }),
    ])
  })

  it('prioritizes billing follow-up near the end of card-free access', () => {
    const now = Date.parse('2026-12-01T18:00:00.000Z')
    const followUps = buildCaptainPilotActivationFollowUps([
      {
        profile_id: 'renewing-captain',
        status: 'converted',
        billing_status: 'not_collected',
        captain_name: 'Riley Renew',
        team_name: 'Match Point',
        converted_at: '2026-09-01T18:00:00.000Z',
        trial_ends_at: '2026-12-06T18:00:00.000Z',
      },
    ], [
      { profile_user_id: 'renewing-captain', team_role: 'captain' },
    ], [
      { user_id: 'renewing-captain', slots_json: [{ players: [{ playerName: 'Player One' }] }] },
    ], [], now)

    expect(followUps).toEqual([
      expect.objectContaining({
        profileId: 'renewing-captain',
        stage: 'billing',
        daysRemaining: 5,
        urgent: true,
      }),
    ])
  })
})
