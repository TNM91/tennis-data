import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  getUpgradeRequestIdFromStripeEvent,
  isStripeCheckoutActivationEvent,
  parseStripeWebhookEvent,
  verifyStripeWebhookSignature,
} from '../stripe-webhook'

const SECRET = 'whsec_test_secret'
const TIMESTAMP = 1_777_777_777

function signPayload(payload: string, timestamp = TIMESTAMP) {
  const signature = createHmac('sha256', SECRET)
    .update(`${timestamp}.${payload}`)
    .digest('hex')

  return `t=${timestamp},v1=${signature}`
}

describe('stripe webhook helpers', () => {
  it('verifies valid Stripe webhook signatures', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' })

    expect(verifyStripeWebhookSignature({
      payload,
      signatureHeader: signPayload(payload),
      secret: SECRET,
      nowSeconds: TIMESTAMP,
    })).toBe(true)
  })

  it('rejects changed payloads and stale signatures', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' })

    expect(verifyStripeWebhookSignature({
      payload: JSON.stringify({ id: 'evt_2', type: 'checkout.session.completed' }),
      signatureHeader: signPayload(payload),
      secret: SECRET,
      nowSeconds: TIMESTAMP,
    })).toBe(false)

    expect(verifyStripeWebhookSignature({
      payload,
      signatureHeader: signPayload(payload, TIMESTAMP - 1_000),
      secret: SECRET,
      nowSeconds: TIMESTAMP,
    })).toBe(false)
  })

  it('parses signed checkout events and extracts upgrade request metadata', () => {
    const payload = JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          metadata: {
            upgrade_request_id: 'request-1',
          },
        },
      },
    })
    const event = parseStripeWebhookEvent({
      payload,
      signatureHeader: signPayload(payload),
      secret: SECRET,
      nowSeconds: TIMESTAMP,
    })

    expect(isStripeCheckoutActivationEvent(event)).toBe(true)
    expect(getUpgradeRequestIdFromStripeEvent(event)).toBe('request-1')
  })

  it('ignores non-checkout activation events', () => {
    expect(isStripeCheckoutActivationEvent({ type: 'invoice.paid' })).toBe(false)
  })
})
