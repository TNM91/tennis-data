import { createClient } from '@supabase/supabase-js'
import { isSafeLocalNextHref } from '@/lib/plan-intent'
import type { PricingPlanId } from '@/lib/pricing-plans'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import {
  buildStripeCheckoutSessionParams,
  getStripePriceId,
  type PaidPricingPlanId,
} from '@/lib/stripe-checkout'

export const runtime = 'nodejs'

type CheckoutSessionBody = {
  requestId?: unknown
  nextHref?: unknown
}

type UpgradeRequestCheckoutRow = {
  id: string
  plan_id: PricingPlanId | string | null
  requester_user_id: string | null
  requester_email: string | null
  next_href: string | null
  status: string | null
}

const PAID_PLAN_IDS: PaidPricingPlanId[] = ['player_plus', 'captain', 'league']
const STRIPE_API_VERSION = '2026-04-22.dahlia'

export async function POST(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in before checkout.' }, { status: 401 })
  }

  let body: CheckoutSessionBody
  try {
    body = (await request.json()) as CheckoutSessionBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid checkout request.' }, { status: 400 })
  }

  const requestId = cleanString(body.requestId)
  if (!requestId) {
    return Response.json({ ok: false, message: 'Missing upgrade request id.' }, { status: 400 })
  }

  const userResult = await getRequesterUser(token)
  if (!userResult.userId) {
    return Response.json({ ok: false, message: 'Sign in before checkout.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return Response.json(
      { ok: false, message: 'Checkout setup is missing Supabase service access.' },
      { status: 500 },
    )
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeSecretKey) {
    return Response.json(
      { ok: false, message: 'Checkout is not configured yet.' },
      { status: 500 },
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  const { data, error } = await supabase
    .from('upgrade_requests')
    .select('id, plan_id, requester_user_id, requester_email, next_href, status')
    .eq('id', requestId)
    .maybeSingle()

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  const checkoutTarget = resolveCheckoutTarget(data as UpgradeRequestCheckoutRow | null, userResult.userId)
  if (!checkoutTarget.ok) {
    return Response.json(
      { ok: false, message: checkoutTarget.message },
      { status: checkoutTarget.status },
    )
  }

  const priceId = getStripePriceId(checkoutTarget.planId)
  if (!priceId) {
    return Response.json(
      { ok: false, message: `Checkout price is not configured for ${checkoutTarget.planId}.` },
      { status: 500 },
    )
  }

  const origin = new URL(request.url).origin
  const nextHref = isSafeLocalNextHref(
    cleanString(body.nextHref) || checkoutTarget.nextHref,
    checkoutTarget.nextHref || '/pricing',
  )
  const params = buildStripeCheckoutSessionParams({
    planId: checkoutTarget.planId,
    priceId,
    requestId: checkoutTarget.requestId,
    userId: checkoutTarget.userId,
    customerEmail: checkoutTarget.email || userResult.email,
    origin,
    nextHref,
  })

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
    },
    body: params,
  })
  const stripeBody = await response.json().catch(() => null) as
    | { id?: string; url?: string; error?: { message?: string } }
    | null

  if (!response.ok || !stripeBody?.url) {
    return Response.json(
      { ok: false, message: stripeBody?.error?.message || 'Stripe checkout could not be started.' },
      { status: response.ok ? 500 : response.status },
    )
  }

  return Response.json({ ok: true, sessionId: stripeBody.id, url: stripeBody.url })
}

function resolveCheckoutTarget(row: UpgradeRequestCheckoutRow | null, signedInUserId: string):
  | {
      ok: true
      requestId: string
      planId: PaidPricingPlanId
      userId: string
      email: string
      nextHref: string
    }
  | { ok: false; status: number; message: string } {
  if (!row?.id) {
    return { ok: false, status: 404, message: 'Upgrade request was not found.' }
  }

  if (row.status === 'converted') {
    return { ok: false, status: 409, message: 'This request has already been activated.' }
  }

  if (row.status === 'closed') {
    return { ok: false, status: 409, message: 'This request is closed.' }
  }

  if (!row.requester_user_id) {
    return { ok: false, status: 400, message: 'Link this request to your account before checkout.' }
  }

  if (row.requester_user_id !== signedInUserId) {
    return { ok: false, status: 403, message: 'This checkout request belongs to another account.' }
  }

  if (!isPaidPlanId(row.plan_id)) {
    return { ok: false, status: 400, message: 'This plan cannot be checked out.' }
  }

  return {
    ok: true,
    requestId: row.id,
    planId: row.plan_id,
    userId: row.requester_user_id,
    email: row.requester_email ?? '',
    nextHref: row.next_href ?? '',
  }
}

async function getRequesterUser(token: string) {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
  const { data, error } = await supabase.auth.getUser(token)

  if (error) return { userId: undefined, email: undefined }
  return { userId: data.user?.id, email: data.user?.email ?? undefined }
}

function isPaidPlanId(value: unknown): value is PaidPricingPlanId {
  return typeof value === 'string' && PAID_PLAN_IDS.includes(value as PaidPricingPlanId)
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 1000) : ''
}
