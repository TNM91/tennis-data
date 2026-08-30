import { createClient } from '@supabase/supabase-js'
import { isSafeLocalNextHref } from '@/lib/plan-intent'
import type { PricingPlanId } from '@/lib/pricing-plans'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import {
  buildStripeCheckoutSessionParams,
  getStripePriceId,
  type PaidPricingPlanId,
} from '@/lib/stripe-checkout'
import { getTeamInviteOfferEligibility } from '@/lib/team-invite-offers'
import { PAID_CHECKOUT_ENABLED, PAID_CHECKOUT_PAUSED_MESSAGE } from '@/lib/paid-checkout'
import {
  CAPTAIN_PILOT_CAMPAIGN_KEY,
  buildCaptainPilotTrialEnd,
  getCaptainPilotAvailability,
} from '@/lib/captain-pilot'

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

type CaptainPilotRedemptionRow = {
  id: string
  status: string | null
}

const PAID_PLAN_IDS: PaidPricingPlanId[] = [
  'player_plus',
  'coach',
  'captain',
  'league',
  'full_court',
  'club_starter',
  'club_unlimited',
]
const STRIPE_API_VERSION = '2026-04-22.dahlia'

export async function POST(request: Request) {
  if (!PAID_CHECKOUT_ENABLED) {
    return Response.json(
      { ok: false, code: 'checkout_paused', message: PAID_CHECKOUT_PAUSED_MESSAGE },
      { status: 503 },
    )
  }

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

  const stripeSecretKey = process.env.STRIPE_RESTRICTED_KEY?.trim() || process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeSecretKey) {
    return Response.json(
      { ok: false, message: 'Checkout is not configured yet.' },
      { status: 500 },
    )
  }

  const supabase = createServiceSupabaseClient(serviceKey)
  const { data, error } = await supabase
    .from('upgrade_requests')
    .select('id, plan_id, requester_user_id, requester_email, next_href, status')
    .eq('id', requestId)
    .maybeSingle()

  if (error) {
    console.error('Checkout request lookup failed', error)
    return Response.json({ ok: false, message: 'Checkout request could not be loaded.' }, { status: 500 })
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
  const inviteOffer = checkoutTarget.planId === 'captain' || checkoutTarget.planId === 'player_plus'
    ? await getTeamInviteOfferEligibility(supabase, checkoutTarget.userId, checkoutTarget.planId)
    : null
  const pilotRedemption = checkoutTarget.planId === 'captain'
    ? await getCaptainPilotRedemption(supabase, checkoutTarget.requestId, checkoutTarget.userId)
    : null
  if (pilotRedemption?.error) {
    return Response.json({ ok: false, message: pilotRedemption.error }, { status: pilotRedemption.status })
  }
  const [{ data: billingProfile }, { data: clubBilling }] = await Promise.all([
    supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', checkoutTarget.userId)
      .maybeSingle(),
    supabase
      .from('club_billing_accounts')
      .select('stripe_customer_id')
      .eq('owner_user_id', checkoutTarget.userId)
      .maybeSingle(),
  ])
  const customerId = billingProfile?.stripe_customer_id?.trim() || clubBilling?.stripe_customer_id?.trim() || undefined
  const params = buildStripeCheckoutSessionParams({
    planId: checkoutTarget.planId,
    priceId,
    requestId: checkoutTarget.requestId,
    userId: checkoutTarget.userId,
    customerEmail: checkoutTarget.email || userResult.email,
    customerId,
    origin,
    nextHref,
    couponId: inviteOffer?.couponId,
    trialEnd: pilotRedemption?.redemption ? buildCaptainPilotTrialEnd() : undefined,
    campaignKey: pilotRedemption?.redemption ? CAPTAIN_PILOT_CAMPAIGN_KEY : undefined,
    pilotRedemptionId: pilotRedemption?.redemption?.id,
    allowPromotionCodes: !pilotRedemption?.redemption,
  })

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
      'Idempotency-Key': `tenaceiq-checkout-${checkoutTarget.requestId}`,
    },
    body: params,
  })
  const stripeBody = await response.json().catch(() => null) as
    | { id?: string; url?: string; error?: { message?: string } }
    | null

  if (!response.ok || !stripeBody?.url) {
    console.error('Stripe Checkout Session creation failed', { status: response.status, requestId })
    return Response.json(
      { ok: false, message: 'Stripe checkout could not be started.' },
      { status: response.ok ? 500 : response.status },
    )
  }

  if (pilotRedemption?.redemption) {
    const { error: pilotUpdateError } = await supabase
      .from('captain_pilot_redemptions')
      .update({ status: 'checkout_started', updated_at: new Date().toISOString() })
      .eq('id', pilotRedemption.redemption.id)
      .in('status', ['claimed', 'checkout_started'])
    if (pilotUpdateError) console.error('Captain Pilot checkout state update failed', pilotUpdateError)
  }

  return Response.json({ ok: true, sessionId: stripeBody.id, url: stripeBody.url })
}

async function getCaptainPilotRedemption(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  requestId: string,
  userId: string,
): Promise<{ redemption?: CaptainPilotRedemptionRow; error?: string; status: number }> {
  const { data, error } = await supabase
    .from('captain_pilot_redemptions')
    .select('id, status')
    .eq('campaign_key', CAPTAIN_PILOT_CAMPAIGN_KEY)
    .eq('upgrade_request_id', requestId)
    .eq('profile_id', userId)
    .maybeSingle()
  if (error) return { error: 'Pilot checkout could not be verified.', status: 500 }
  if (!data) return { status: 200 }
  if (getCaptainPilotAvailability() !== 'active') {
    return { error: 'The Fall Captain Pilot is not accepting checkout right now.', status: 409 }
  }
  if ((data as CaptainPilotRedemptionRow).status === 'converted') {
    return { error: 'This Fall Captain Pilot claim is already active.', status: 409 }
  }
  return { redemption: data as CaptainPilotRedemptionRow, status: 200 }
}

function createServiceSupabaseClient(serviceKey: string) {
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
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
