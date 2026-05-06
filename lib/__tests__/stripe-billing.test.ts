import { describe, expect, it } from 'vitest'

import {
  buildStripeBillingProfilePayload,
  findStripeCustomerIdForUser,
  getStripeObjectId,
  isStripeBillingProfileColumnError,
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
})
