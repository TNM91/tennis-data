import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { apiServerError } from '@/lib/api-error-response'
import { getStripePriceId, type PaidPricingPlanId } from '@/lib/stripe-checkout'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

const STRIPE_API_VERSION = '2026-04-22.dahlia'
const PAID_PLAN_IDS: PaidPricingPlanId[] = [
  'player_plus',
  'coach',
  'captain',
  'league',
  'full_court',
  'club_starter',
  'club_unlimited',
]

type PromotionDuration = 'once' | 'repeating' | 'forever'

type CreatePromotionBody = {
  action?: 'create'
  code?: unknown
  planId?: unknown
  percentOff?: unknown
  duration?: unknown
  durationMonths?: unknown
  maxRedemptions?: unknown
  redeemBy?: unknown
  firstTimeOnly?: unknown
}

type DeactivatePromotionBody = {
  action?: 'deactivate'
  promotionCodeId?: unknown
}

type StripeCoupon = {
  id?: string
  percent_off?: number | null
  duration?: PromotionDuration | null
  duration_in_months?: number | null
  metadata?: Record<string, string | undefined> | null
}

type StripePromotionCode = {
  id?: string
  code?: string
  active?: boolean
  created?: number
  expires_at?: number | null
  max_redemptions?: number | null
  times_redeemed?: number | null
  metadata?: Record<string, string | undefined> | null
  restrictions?: { first_time_transaction?: boolean | null } | null
  promotion?: { type?: string | null; coupon?: StripeCoupon | string | null } | null
  coupon?: StripeCoupon | string | null
}

export async function GET(request: Request) {
  const context = await getAdminContext(request)
  if (!context.ok) return context.response

  const stripeKey = getStripeKey()
  if (!stripeKey) return notConfiguredResponse()

  const stripeResult = await stripeRequest('/v1/promotion_codes?limit=100&expand[]=data.promotion.coupon', stripeKey)
  if (!stripeResult.ok) {
    return apiServerError('Stripe promotion code list failed', stripeResult.body, 'Stripe promotions could not be loaded.')
  }

  const body = stripeResult.body as { data?: StripePromotionCode[] }
  const promotions = (body.data ?? [])
    .map(toPromotionSummary)
    .filter((promotion): promotion is PromotionSummary => Boolean(promotion))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return Response.json({ ok: true, promotions })
}

export async function POST(request: Request) {
  const context = await getAdminContext(request)
  if (!context.ok) return context.response

  const stripeKey = getStripeKey()
  if (!stripeKey) return notConfiguredResponse()

  let body: CreatePromotionBody | DeactivatePromotionBody
  try {
    body = (await request.json()) as CreatePromotionBody | DeactivatePromotionBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid promotion request.' }, { status: 400 })
  }

  if (body.action === 'deactivate') {
    return deactivatePromotion(context, stripeKey, cleanText(body.promotionCodeId, 120))
  }

  return createPromotion(context, stripeKey, body as CreatePromotionBody)
}

async function createPromotion(
  context: Extract<AdminContext, { ok: true }>,
  stripeKey: string,
  body: CreatePromotionBody,
) {
  const code = normalizePromotionCode(body.code)
  const planId = isPaidPlanId(body.planId) ? body.planId : null
  const percentOff = normalizeWholeNumber(body.percentOff, 1, 100)
  const duration = normalizeDuration(body.duration)
  const durationMonths = duration === 'repeating'
    ? normalizeWholeNumber(body.durationMonths, 1, 24)
    : null
  const maxRedemptions = body.maxRedemptions == null || body.maxRedemptions === ''
    ? null
    : normalizeWholeNumber(body.maxRedemptions, 1, 10000)
  const redeemBy = normalizeFutureUnixTimestamp(body.redeemBy)
  const firstTimeOnly = body.firstTimeOnly === true

  if (!code || !planId || !percentOff || !duration || (duration === 'repeating' && !durationMonths)) {
    return Response.json(
      { ok: false, message: 'Add a code, plan, valid discount, and duration before creating a promotion.' },
      { status: 400 },
    )
  }

  const priceId = getStripePriceId(planId)
  if (!priceId) {
    return Response.json({ ok: false, message: `Stripe price is not configured for ${planId}.` }, { status: 500 })
  }

  const priceResult = await stripeRequest(`/v1/prices/${encodeURIComponent(priceId)}`, stripeKey)
  if (!priceResult.ok) {
    return apiServerError('Stripe price lookup failed', priceResult.body, 'The selected plan could not be prepared for a promotion.')
  }
  const productId = getStripeObjectId((priceResult.body as { product?: unknown }).product)
  if (!productId) {
    return Response.json({ ok: false, message: 'The selected Stripe price is missing its product.' }, { status: 500 })
  }

  const couponParams = new URLSearchParams()
  couponParams.set('percent_off', String(percentOff))
  couponParams.set('duration', duration)
  couponParams.set('name', `TenAceIQ ${planId} ${percentOff}%`)
  couponParams.set('applies_to[products][0]', productId)
  couponParams.set('metadata[tenaceiq_plan_id]', planId)
  couponParams.set('metadata[tenaceiq_promotion_code]', code)
  if (durationMonths) couponParams.set('duration_in_months', String(durationMonths))

  const couponResult = await stripeRequest('/v1/coupons', stripeKey, couponParams)
  const couponId = getStripeObjectId((couponResult.body as { id?: unknown } | null)?.id)
  if (!couponResult.ok || !couponId) {
    return apiServerError('Stripe coupon creation failed', couponResult.body, 'Stripe could not create that discount.')
  }

  const promotionParams = new URLSearchParams()
  promotionParams.set('promotion[type]', 'coupon')
  promotionParams.set('promotion[coupon]', couponId)
  promotionParams.set('code', code)
  promotionParams.set('active', 'true')
  promotionParams.set('expand[]', 'promotion.coupon')
  promotionParams.set('metadata[tenaceiq_plan_id]', planId)
  if (maxRedemptions) promotionParams.set('max_redemptions', String(maxRedemptions))
  if (redeemBy) promotionParams.set('expires_at', String(redeemBy))
  if (firstTimeOnly) promotionParams.set('restrictions[first_time_transaction]', 'true')

  const promotionResult = await stripeRequest('/v1/promotion_codes', stripeKey, promotionParams)
  if (!promotionResult.ok) {
    await stripeRequest(`/v1/coupons/${encodeURIComponent(couponId)}`, stripeKey, undefined, 'DELETE')
    return apiServerError('Stripe promotion code creation failed', promotionResult.body, 'Stripe could not create that promotion code.')
  }

  const promotion = toPromotionSummary(promotionResult.body as StripePromotionCode)
  await recordAdminAudit(context.service, {
    actorUserId: context.userId,
    action: 'stripe_promotion_created',
    targetId: promotion?.id ?? couponId,
    targetLabel: code,
    metadata: {
      planId,
      percentOff,
      duration,
      durationMonths,
      maxRedemptions,
      redeemBy: redeemBy ? new Date(redeemBy * 1000).toISOString() : null,
      firstTimeOnly,
      couponId,
    },
  })

  return Response.json({ ok: true, promotion })
}

async function deactivatePromotion(context: Extract<AdminContext, { ok: true }>, stripeKey: string, promotionCodeId: string) {
  if (!promotionCodeId) {
    return Response.json({ ok: false, message: 'Missing promotion code.' }, { status: 400 })
  }

  const params = new URLSearchParams()
  params.set('active', 'false')
  params.set('expand[]', 'promotion.coupon')
  const result = await stripeRequest(`/v1/promotion_codes/${encodeURIComponent(promotionCodeId)}`, stripeKey, params)
  if (!result.ok) {
    return apiServerError('Stripe promotion code deactivation failed', result.body, 'Stripe could not deactivate that promotion code.')
  }

  const promotion = toPromotionSummary(result.body as StripePromotionCode)
  await recordAdminAudit(context.service, {
    actorUserId: context.userId,
    action: 'stripe_promotion_deactivated',
    targetId: promotionCodeId,
    targetLabel: promotion?.code ?? promotionCodeId,
    metadata: { couponId: promotion?.couponId ?? null, planId: promotion?.planId ?? null },
  })

  return Response.json({ ok: true, promotion })
}

type PromotionSummary = {
  id: string
  code: string
  active: boolean
  createdAt: string
  expiresAt: string | null
  maxRedemptions: number | null
  timesRedeemed: number
  percentOff: number | null
  duration: PromotionDuration | null
  durationMonths: number | null
  planId: string
  couponId: string
  firstTimeOnly: boolean
}

function toPromotionSummary(value: StripePromotionCode): PromotionSummary | null {
  const promotionCoupon = value.promotion?.coupon ?? value.coupon
  const coupon = typeof promotionCoupon === 'object' && promotionCoupon ? promotionCoupon : null
  const planId = coupon?.metadata?.tenaceiq_plan_id?.trim() || value.metadata?.tenaceiq_plan_id?.trim() || ''
  const id = cleanText(value.id, 120)
  const code = cleanText(value.code, 120)
  if (!id || !code || !planId) return null

  return {
    id,
    code,
    active: value.active !== false,
    createdAt: value.created ? new Date(value.created * 1000).toISOString() : new Date(0).toISOString(),
    expiresAt: value.expires_at ? new Date(value.expires_at * 1000).toISOString() : null,
    maxRedemptions: typeof value.max_redemptions === 'number' ? value.max_redemptions : null,
    timesRedeemed: typeof value.times_redeemed === 'number' ? value.times_redeemed : 0,
    percentOff: typeof coupon?.percent_off === 'number' ? coupon.percent_off : null,
    duration: coupon?.duration ?? null,
    durationMonths: typeof coupon?.duration_in_months === 'number' ? coupon.duration_in_months : null,
    planId,
    couponId: cleanText(coupon?.id, 120),
    firstTimeOnly: value.restrictions?.first_time_transaction === true,
  }
}

type AdminContext =
  | { ok: true; userId: string; service: SupabaseClient }
  | { ok: false; response: Response }

async function getAdminContext(request: Request): Promise<AdminContext> {
  const token = getBearerToken(request)
  if (!token) {
    return { ok: false, response: Response.json({ ok: false, message: 'Sign in as an admin to manage promotions.' }, { status: 401 }) }
  }

  const auth = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: authData, error: authError } = await auth.auth.getUser(token)
  if (authError || !authData.user?.id) {
    return { ok: false, response: Response.json({ ok: false, message: 'Sign in as an admin to manage promotions.' }, { status: 401 }) }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return { ok: false, response: Response.json({ ok: false, message: 'Promotion management is missing Supabase service access.' }, { status: 500 }) }
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle()
  if (profileError || profile?.role !== 'admin') {
    return { ok: false, response: Response.json({ ok: false, message: 'Admin access is required.' }, { status: 403 }) }
  }

  return { ok: true, userId: authData.user.id, service }
}

async function recordAdminAudit(
  service: SupabaseClient,
  event: {
    actorUserId: string
    action: string
    targetId: string
    targetLabel: string
    metadata: Record<string, unknown>
  },
) {
  const { error } = await service.from('admin_audit_events').insert({
    actor_user_id: event.actorUserId,
    action: event.action,
    target_type: 'stripe_promotion_code',
    target_id: event.targetId,
    target_label: event.targetLabel,
    metadata: event.metadata,
  })
  if (error) console.error('Stripe promotion audit record failed', error)
}

function getStripeKey() {
  return process.env.STRIPE_RESTRICTED_KEY?.trim() || process.env.STRIPE_SECRET_KEY?.trim() || ''
}

function notConfiguredResponse() {
  return Response.json(
    { ok: false, message: 'Stripe promotions are not configured yet. Add Coupon, Promotion Code, and Price permissions to the Stripe restricted key.' },
    { status: 500 },
  )
}

async function stripeRequest(path: string, stripeKey: string, body?: URLSearchParams, method?: 'DELETE') {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
    },
    body,
  })
  return { ok: response.ok, body: await response.json().catch(() => null) }
}

function isPaidPlanId(value: unknown): value is PaidPricingPlanId {
  return typeof value === 'string' && PAID_PLAN_IDS.includes(value as PaidPricingPlanId)
}

function normalizePromotionCode(value: unknown) {
  return cleanText(value, 40).toUpperCase().replace(/[^A-Z0-9-]/g, '')
}

function normalizeDuration(value: unknown): PromotionDuration | null {
  return value === 'once' || value === 'repeating' || value === 'forever' ? value : null
}

function normalizeWholeNumber(value: unknown, min: number, max: number) {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(numeric) && numeric >= min && numeric <= max ? numeric : null
}

function normalizeFutureUnixTimestamp(value: unknown) {
  const raw = cleanText(value, 32)
  if (!raw) return null
  const timestamp = Date.parse(`${raw}T23:59:59.999Z`)
  return Number.isFinite(timestamp) && timestamp > Date.now() ? Math.floor(timestamp / 1000) : null
}

function getStripeObjectId(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id.trim()
  return ''
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : ''
}
