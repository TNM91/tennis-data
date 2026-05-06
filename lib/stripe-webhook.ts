import { createHmac, timingSafeEqual } from 'node:crypto'

export type StripeWebhookEvent = {
  id?: string
  type?: string
  data?: {
    object?: {
      id?: string
      status?: string | null
      payment_status?: string | null
      customer?: string | { id?: string | null } | null
      customer_email?: string | null
      subscription?: string | { id?: string | null } | null
      metadata?: Record<string, string | undefined> | null
    }
  }
}

export const STRIPE_CHECKOUT_ACTIVATION_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
] as const

const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300

export function parseStripeWebhookEvent({
  payload,
  signatureHeader,
  secret,
  toleranceSeconds = DEFAULT_SIGNATURE_TOLERANCE_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  payload: string
  signatureHeader: string
  secret: string
  toleranceSeconds?: number
  nowSeconds?: number
}): StripeWebhookEvent {
  if (!verifyStripeWebhookSignature({
    payload,
    signatureHeader,
    secret,
    toleranceSeconds,
    nowSeconds,
  })) {
    throw new Error('Invalid Stripe webhook signature.')
  }

  return JSON.parse(payload) as StripeWebhookEvent
}

export function verifyStripeWebhookSignature({
  payload,
  signatureHeader,
  secret,
  toleranceSeconds = DEFAULT_SIGNATURE_TOLERANCE_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  payload: string
  signatureHeader: string
  secret: string
  toleranceSeconds?: number
  nowSeconds?: number
}) {
  const parsed = parseStripeSignatureHeader(signatureHeader)
  if (!parsed.timestamp || parsed.signatures.length === 0) return false
  if (Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) return false

  const expected = createHmac('sha256', secret)
    .update(`${parsed.timestamp}.${payload}`)
    .digest('hex')

  return parsed.signatures.some((signature) => timingSafeHexEqual(signature, expected))
}

export function isStripeCheckoutActivationEvent(event: StripeWebhookEvent) {
  return STRIPE_CHECKOUT_ACTIVATION_EVENTS.includes(
    event.type as (typeof STRIPE_CHECKOUT_ACTIVATION_EVENTS)[number],
  )
}

export function getUpgradeRequestIdFromStripeEvent(event: StripeWebhookEvent) {
  return event.data?.object?.metadata?.upgrade_request_id?.trim() ?? ''
}

function parseStripeSignatureHeader(header: string) {
  const parts = header.split(',').map((part) => part.trim())
  const timestampPart = parts.find((part) => part.startsWith('t='))
  const timestamp = Number(timestampPart?.slice(2))
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))
    .filter(Boolean)

  return {
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    signatures,
  }
}

function timingSafeHexEqual(left: string, right: string) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false
  const leftBuffer = Buffer.from(left, 'hex')
  const rightBuffer = Buffer.from(right, 'hex')
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}
