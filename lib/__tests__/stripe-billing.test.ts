import { describe, expect, it } from 'vitest'

import {
  buildStripeBillingEventAuditPayload,
  buildStripeBillingProfilePayload,
  buildStripeSubscriptionProfileUpdate,
  findStripeCustomerIdForUser,
  getStripeSubscriptionResultingStatus,
  getStripeObjectId,
  isStripeBillingProfileColumnError,
  isStripeSubscriptionLifecycleEvent,
  removeStripeBillingProfileFields,
} from '../stripe-billing'

describe('Stripe billing helpers', () => {
  it('normalizes Stripe object references', () => {
    expect(getStripeObjectId('cus_123')).toBe('cus_123')
    expect(getStripeObjectId({ id: 'sub_123' })).toBe('sub_123')
    expect(getStripeObjectId(null)).toBe('')
  })

  it('builds profile billing payloads from checkout sessions', () => {
    expect(buildStripeBillingProfilePayload({
      customer: 'cus_123',
      subscription: { id: 'sub_123' },
    })).toEqual({
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
    })
  })

  it('removes Stripe billing fields for migration-safe retries', () => {
    expect(removeStripeBillingProfileFields({
      player_plus_subscription_active: true,
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
    })).toEqual({
      player_plus_subscription_active: true,
    })
  })

  it('recognizes missing Stripe billing profile columns', () => {
    expect(isStripeBillingProfileColumnError({ code: 'PGRST204' })).toBe(true)
    expect(isStripeBillingProfileColumnError({ message: 'Could not find stripe_customer_id in schema cache' })).toBe(true)
    expect(isStripeBillingProfileColumnError({ message: 'permission denied' })).toBe(false)
  })

  it('finds a recent paid checkout customer for a user', () => {
    expect(findStripeCustomerIdForUser([
      {
        id: 'cs_wrong',
        status: 'complete',
        payment_status: 'paid',
        customer: 'cus_wrong',
        metadata: { user_id: 'other-user' },
      },
      {
        id: 'cs_right',
        status: 'complete',
        payment_status: 'paid',
        customer: { id: 'cus_right' },
        metadata: { user_id: 'user-1' },
      },
    ], { userId: 'user-1', email: 'player@example.com' })).toBe('cus_right')
  })

  it('ignores unpaid checkout sessions when looking up customers', () => {
    expect(findStripeCustomerIdForUser([
      {
        id: 'cs_open',
        status: 'open',
        payment_status: 'unpaid',
        customer: 'cus_open',
        customer_email: 'player@example.com',
      },
    ], { userId: 'user-1', email: 'player@example.com' })).toBe('')
  })

  it('activates captain entitlements from subscription lifecycle metadata', () => {
    const update = buildStripeSubscriptionProfileUpdate({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_captain',
          status: 'active',
          customer: 'cus_123',
          metadata: {
            user_id: 'user-1',
            plan_id: 'captain',
          },
        },
      },
    })

    expect(update).toEqual({
      userId: 'user-1',
      subscriptionId: 'sub_captain',
      customerId: 'cus_123',
      planId: 'captain',
      payload: {
        player_plus_subscription_active: true,
        player_plus_subscription_status: 'active',
        captain_subscription_active: true,
        captain_subscription_status: 'active',
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_captain',
      },
    })
    expect(update ? getStripeSubscriptionResultingStatus(update) : '').toBe('active')
  })

  it('activates coach entitlements with Player access from subscription lifecycle metadata', () => {
    const update = buildStripeSubscriptionProfileUpdate({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_coach',
          status: 'active',
          customer: 'cus_coach',
          metadata: {
            user_id: 'user-coach',
            plan_id: 'coach',
          },
        },
      },
    })

    expect(update).toEqual({
      userId: 'user-coach',
      subscriptionId: 'sub_coach',
      customerId: 'cus_coach',
      planId: 'coach',
      payload: {
        player_plus_subscription_active: true,
        player_plus_subscription_status: 'active',
        coach_subscription_active: true,
        coach_subscription_status: 'active',
        stripe_customer_id: 'cus_coach',
        stripe_subscription_id: 'sub_coach',
      },
    })
    expect(update ? getStripeSubscriptionResultingStatus(update) : '').toBe('active')
  })

  it('downgrades player subscriptions when Stripe reports cancellation', () => {
    expect(buildStripeSubscriptionProfileUpdate({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_player',
          status: 'canceled',
          customer: 'cus_123',
          metadata: {
            user_id: 'user-1',
            plan_id: 'player_plus',
          },
        },
      },
    })?.payload).toEqual({
      player_plus_subscription_active: false,
      player_plus_subscription_status: 'canceled',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_player',
    })
  })

  it('revokes paid access on failed invoice payments using subscription metadata', () => {
    expect(buildStripeSubscriptionProfileUpdate({
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_123',
          customer: 'cus_123',
          subscription: 'sub_captain',
          parent: {
            subscription_details: {
              metadata: {
                user_id: 'user-1',
                plan_id: 'captain',
              },
            },
          },
        },
      },
    })?.payload).toEqual({
      player_plus_subscription_active: false,
      player_plus_subscription_status: 'past_due',
      captain_subscription_active: false,
      captain_subscription_status: 'past_due',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_captain',
    })
  })

  it('revokes coach and Player access on failed coach invoice payments', () => {
    expect(buildStripeSubscriptionProfileUpdate({
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_coach',
          customer: 'cus_coach',
          subscription: 'sub_coach',
          parent: {
            subscription_details: {
              metadata: {
                user_id: 'user-coach',
                plan_id: 'coach',
              },
            },
          },
        },
      },
    })?.payload).toEqual({
      player_plus_subscription_active: false,
      player_plus_subscription_status: 'past_due',
      coach_subscription_active: false,
      coach_subscription_status: 'past_due',
      stripe_customer_id: 'cus_coach',
      stripe_subscription_id: 'sub_coach',
    })
  })

  it('ignores non-subscription billing events and one-time league plans', () => {
    expect(isStripeSubscriptionLifecycleEvent({ type: 'checkout.session.completed' })).toBe(false)
    expect(buildStripeSubscriptionProfileUpdate({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          status: 'active',
          metadata: {
            user_id: 'user-1',
            plan_id: 'league',
          },
        },
      },
    })).toBeNull()
  })

  it('builds Stripe billing event audit payloads', () => {
    expect(buildStripeBillingEventAuditPayload({
      event: {
        id: 'evt_123',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            metadata: {
              plan_id: 'player_plus',
            },
          },
        },
      },
      outcome: 'handled',
      profileId: 'user-1',
      resultingStatus: 'active',
    })).toEqual({
      stripe_event_id: 'evt_123',
      event_type: 'customer.subscription.updated',
      outcome: 'handled',
      message: '',
      profile_id: 'user-1',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: null,
      plan_id: 'player_plus',
      resulting_status: 'active',
      event_object: {
        id: 'sub_123',
        customer: 'cus_123',
        metadata: {
          plan_id: 'player_plus',
        },
      },
    })
  })

  it('skips audit payloads without Stripe event identity', () => {
    expect(buildStripeBillingEventAuditPayload({
      event: {
        type: 'customer.subscription.updated',
      },
      outcome: 'ignored',
    })).toBeNull()
  })
})
