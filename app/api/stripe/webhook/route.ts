import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/supabase'
import { buildProfileActivationPayload, resolveUpgradeActivationTarget } from '@/lib/upgrade-activation'
import {
  buildStripeBillingProfilePayload,
  buildStripeSubscriptionProfileUpdate,
  isStripeBillingProfileColumnError,
  isStripeSubscriptionLifecycleEvent,
  removeStripeBillingProfileFields,
} from '@/lib/stripe-billing'
import {
  getUpgradeRequestIdFromStripeEvent,
  isStripeCheckoutActivationEvent,
  parseStripeWebhookEvent,
} from '@/lib/stripe-webhook'

export const runtime = 'nodejs'

type UpgradeRequestActivationRow = {
  id: string
  plan_id: string | null
  requester_user_id: string | null
  status: string | null
}

type SupabaseProfileUpdater = {
  from(table: 'profiles'): {
    update(payload: Record<string, unknown>): {
      eq(column: 'id' | 'stripe_subscription_id' | 'stripe_customer_id', value: string):
        PromiseLike<{ error: { code?: string; message?: string } | null }>
    }
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    return Response.json({ ok: false, message: 'Stripe webhook is not configured.' }, { status: 500 })
  }

  const payload = await request.text()
  const signatureHeader = request.headers.get('stripe-signature') ?? ''
  let event

  try {
    event = parseStripeWebhookEvent({
      payload,
      signatureHeader,
      secret: webhookSecret,
    })
  } catch {
    return Response.json({ ok: false, message: 'Invalid Stripe webhook signature.' }, { status: 400 })
  }

  if (isStripeSubscriptionLifecycleEvent(event)) {
    const lifecycleUpdate = buildStripeSubscriptionProfileUpdate(event)
    if (!lifecycleUpdate) {
      return Response.json({ ok: true, ignored: true, message: 'Missing subscription metadata.' })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      return Response.json({ ok: false, message: 'Supabase service access is not configured.' }, { status: 500 })
    }

    const supabase = createServiceSupabaseClient(serviceKey)
    const profileError = await updateProfileForStripeSubscription(
      supabase,
      lifecycleUpdate,
    )

    if (profileError) {
      return Response.json({ ok: false, message: profileError.message }, { status: 500 })
    }

    return Response.json({
      ok: true,
      updated: lifecycleUpdate.planId,
      status: lifecycleUpdate.payload[`${lifecycleUpdate.planId === 'captain' ? 'captain' : 'player_plus'}_subscription_status`],
    })
  }

  if (!isStripeCheckoutActivationEvent(event)) {
    return Response.json({ ok: true, ignored: true })
  }

  const requestId = getUpgradeRequestIdFromStripeEvent(event)
  if (!requestId) {
    return Response.json({ ok: true, ignored: true, message: 'Missing upgrade request metadata.' })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return Response.json({ ok: false, message: 'Supabase service access is not configured.' }, { status: 500 })
  }

  const supabase = createServiceSupabaseClient(serviceKey)
  const { data: requestRow, error: requestLoadError } = await supabase
    .from('upgrade_requests')
    .select('id, plan_id, requester_user_id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (requestLoadError) {
    return Response.json({ ok: false, message: requestLoadError.message }, { status: 500 })
  }

  const activationTarget = resolveUpgradeActivationTarget(toActivationRequestSource(requestRow as UpgradeRequestActivationRow | null))

  if (!activationTarget.ok) {
    if (activationTarget.message === 'This request has already been activated.') {
      return Response.json({ ok: true, ignored: true, message: activationTarget.message })
    }

    return Response.json(
      { ok: false, message: activationTarget.message },
      { status: activationTarget.status },
    )
  }

  const profilePayload = {
    ...buildProfileActivationPayload(activationTarget.planId),
    ...buildStripeBillingProfilePayload(event.data?.object),
  }
  const profileError = await updateProfileWithBillingFallback(
    supabase,
    activationTarget.userId,
    profilePayload,
  )

  if (profileError) {
    return Response.json({ ok: false, message: profileError.message }, { status: 500 })
  }

  const { error: requestError } = await supabase
    .from('upgrade_requests')
    .update({ status: 'converted' })
    .eq('id', activationTarget.requestId)

  if (requestError) {
    return Response.json({ ok: false, message: requestError.message }, { status: 500 })
  }

  return Response.json({ ok: true, activated: activationTarget.planId })
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

function toActivationRequestSource(row: UpgradeRequestActivationRow | null) {
  if (!row) return null

  return {
    id: String(row.id),
    planId: typeof row.plan_id === 'string' ? row.plan_id : null,
    userId: typeof row.requester_user_id === 'string' ? row.requester_user_id : null,
    status: typeof row.status === 'string' ? row.status : null,
  }
}

async function updateProfileWithBillingFallback(
  supabase: SupabaseProfileUpdater,
  userId: string,
  payload: Record<string, boolean | string>,
) {
  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)

  if (!error || !isStripeBillingProfileColumnError(error)) {
    return error
  }

  const { error: retryError } = await supabase
    .from('profiles')
    .update(removeStripeBillingProfileFields(payload))
    .eq('id', userId)

  return retryError
}

async function updateProfileForStripeSubscription(
  supabase: SupabaseProfileUpdater,
  lifecycleUpdate: {
    userId: string
    subscriptionId: string
    customerId: string
    payload: Record<string, boolean | string>
  },
) {
  if (lifecycleUpdate.userId) {
    return updateProfileWithBillingFallback(supabase, lifecycleUpdate.userId, lifecycleUpdate.payload)
  }

  if (lifecycleUpdate.subscriptionId) {
    return updateProfileByStripeField(
      supabase,
      'stripe_subscription_id',
      lifecycleUpdate.subscriptionId,
      lifecycleUpdate.payload,
    )
  }

  return updateProfileByStripeField(
    supabase,
    'stripe_customer_id',
    lifecycleUpdate.customerId,
    lifecycleUpdate.payload,
  )
}

async function updateProfileByStripeField(
  supabase: SupabaseProfileUpdater,
  column: 'stripe_subscription_id' | 'stripe_customer_id',
  value: string,
  payload: Record<string, boolean | string>,
) {
  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq(column, value)

  return error
}
