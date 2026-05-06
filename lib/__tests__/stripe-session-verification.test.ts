import { describe, expect, it } from 'vitest'

import {
  findPaidStripeCheckoutSessionForRequest,
  isPaidStripeCheckoutSessionForRequest,
} from '../stripe-session-verification'

describe('Stripe checkout session verification', () => {
  const target = { requestId: 'request-1', userId: 'user-1' }

  it('accepts complete paid sessions with matching request and user metadata', () => {
    expect(isPaidStripeCheckoutSessionForRequest({
      id: 'cs_1',
      status: 'complete',
      payment_status: 'paid',
      client_reference_id: 'request-1',
      metadata: {
        upgrade_request_id: 'request-1',
        user_id: 'user-1',
      },
    }, target)).toBe(true)
  })

  it('rejects unpaid, incomplete, or mismatched sessions', () => {
    expect(isPaidStripeCheckoutSessionForRequest({
      id: 'cs_1',
      status: 'open',
      payment_status: 'unpaid',
      client_reference_id: 'request-1',
      metadata: { user_id: 'user-1' },
    }, target)).toBe(false)

    expect(isPaidStripeCheckoutSessionForRequest({
      id: 'cs_2',
      status: 'complete',
      payment_status: 'paid',
      client_reference_id: 'request-1',
      metadata: { user_id: 'other-user' },
    }, target)).toBe(false)
  })

  it('finds a matching paid session from a recent session list', () => {
    expect(findPaidStripeCheckoutSessionForRequest([
      {
        id: 'cs_wrong',
        status: 'complete',
        payment_status: 'paid',
        client_reference_id: 'request-2',
        metadata: { user_id: 'user-1' },
      },
      {
        id: 'cs_right',
        status: 'complete',
        payment_status: 'paid',
        client_reference_id: 'request-1',
        metadata: { user_id: 'user-1' },
      },
    ], target)?.id).toBe('cs_right')
  })
})
