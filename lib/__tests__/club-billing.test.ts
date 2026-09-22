import { describe, expect, it } from 'vitest'

import {
  buildClubBillingCheckoutPayload,
  buildClubBillingSubscriptionUpdate,
  isActiveClubBillingStatus,
  mapClubBillingAccountRow,
} from '../club-billing'

describe('Club billing', () => {
  it('activates a Club owner from a completed subscription checkout', () => {
    expect(buildClubBillingCheckoutPayload({
      customer: { id: 'cus_club' },
      subscription: 'sub_club',
    }, 'owner-1', 'club_starter')).toEqual({
      owner_user_id: 'owner-1',
      plan_id: 'club_starter',
      status: 'active',
      stripe_customer_id: 'cus_club',
      stripe_subscription_id: 'sub_club',
    })
  })

  it('maps active and terminal Stripe subscription events', () => {
    const active = buildClubBillingSubscriptionUpdate({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_club',
          customer: 'cus_club',
          status: 'active',
          metadata: { plan_id: 'club_unlimited', user_id: 'owner-1' },
        },
      },
    })
    expect(active).toMatchObject({
      owner_user_id: 'owner-1',
      plan_id: 'club_unlimited',
      status: 'active',
      stripe_subscription_id: 'sub_club',
    })

    expect(buildClubBillingSubscriptionUpdate({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_club',
          customer: 'cus_club',
          metadata: { plan_id: 'club_unlimited', user_id: 'owner-1' },
        },
      },
    })?.status).toBe('canceled')

    expect(buildClubBillingSubscriptionUpdate({
      type: 'invoice.payment_failed',
      data: {
        object: {
          subscription: 'sub_club',
          customer: 'cus_club',
          parent: {
            subscription_details: {
              metadata: { plan_id: 'club_starter', user_id: 'owner-1' },
            },
          },
        },
      },
    })?.status).toBe('past_due')
  })

  it('rejects unrelated events and normalizes stored rows', () => {
    expect(buildClubBillingSubscriptionUpdate({
      type: 'customer.subscription.updated',
      data: { object: { metadata: { plan_id: 'captain', user_id: 'user-1' } } },
    })).toBeNull()

    expect(mapClubBillingAccountRow({
      owner_user_id: ' owner-1 ',
      plan_id: 'club_starter',
      status: 'trial',
      stripe_customer_id: ' cus_club ',
      stripe_subscription_id: ' sub_club ',
    })).toEqual({
      ownerUserId: 'owner-1',
      planId: 'club_starter',
      status: 'trial',
      stripeCustomerId: 'cus_club',
      stripeSubscriptionId: 'sub_club',
    })
    expect(mapClubBillingAccountRow({ owner_user_id: 'owner-1', plan_id: 'captain' })).toBeNull()
    expect(isActiveClubBillingStatus('active')).toBe(true)
    expect(isActiveClubBillingStatus('trial')).toBe(true)
    expect(isActiveClubBillingStatus('past_due')).toBe(false)
  })
})
