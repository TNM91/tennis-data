import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/supabase'
import { buildProfileActivationPayload, resolveUpgradeActivationTarget } from '@/lib/upgrade-activation'
import {
  buildStripeBillingEventAuditPayload,
  buildStripeBillingProfilePayload,
  buildStripeSubscriptionProfileUpdate,
  getStripeSubscriptionResultingStatus,
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

type SupabaseBillingAuditInserter = {
  from(table: 'stripe_billing_events'): {
    upsert(
      payload: Record<string, unknown>,
      options: { onConflict: 'stripe_event_id' },
    ): PromiseLike<{ error: { code?: string; message?: string } | null }>
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

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = serviceKey ? createServiceSupabaseClient(serviceKey) : null

  if (isStripeSubscriptionLifecycleEvent(event)) {
    const lifecycleUpdate = buildStripeSubscriptionProfileUpdate(event)
    if (!lifecycleUpdate) {
      if (supabase) {
        await recordStripeBillingEvent(supabase, {
          event,
          outcome: 'ignored',
          message: 'Missing subscription metadata.',
        })
      }
      return Response.json({ ok: true, ignored: true, message: 'Missing subscription metadata.' })
    }

    if (!supabase) {
      return Response.json({ ok: false, message: 'Supabase service access is not configured.' }, { status: 500 })
    }

    const profileError = await updateProfileForStripeSubscription(
      supabase,
      lifecycleUpdate,
    )

    if (profileError) {
      await recordStripeBillingEvent(supabase, {
        event,
        outcome: 'error',
        message: profileError.message,
        profileId: lifecycleUpdate.userId,
        customerId: lifecycleUpdate.customerId,
        subscriptionId: lifecycleUpdate.subscriptionId,
        planId: lifecycleUpdate.planId,
        resultingStatus: getStripeSubscriptionResultingStatus(lifecycleUpdate),
      })
      return Response.json({ ok: false, message: profileError.message }, { status: 500 })
    }

    const resultingStatus = getStripeSubscriptionResultingStatus(lifecycleUpdate)
    await recordStripeBillingEvent(supabase, {
      event,
      outcome: 'handled',
      profileId: lifecycleUpdate.userId,
      customerId: lifecycleUpdate.customerId,
      subscriptionId: lifecycleUpdate.subscriptionId,
      planId: lifecycleUpdate.planId,
      resultingStatus,
    })

    return Response.json({
      ok: true,
      updated: lifecycleUpdate.planId,
      status: resultingStatus,
    })
  }

  if (!isStripeCheckoutActivationEvent(event)) {
    if (supabase) {
      await recordStripeBillingEvent(supabase, {
        event,
        outcome: 'ignored',
        message: 'Unsupported Stripe event type.',
      })
    }
    return Response.json({ ok: true, ignored: true })
  }

  const requestId = getUpgradeRequestIdFromStripeEvent(event)
  if (!requestId) {
    if (supabase) {
      await recordStripeBillingEvent(supabase, {
        event,
        outcome: 'ignored',
        message: 'Missing upgrade request metadata.',
      })
    }
    return Response.json({ ok: true, ignored: true, message: 'Missing upgrade request metadata.' })
  }

  if (!supabase) {
    return Response.json({ ok: false, message: 'Supabase service access is not configured.' }, { status: 500 })
  }

  const { data: requestRow, error: requestLoadError } = await supabase
    .from('upgrade_requests')
    .select('id, plan_id, requester_user_id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (requestLoadError) {
    await recordStripeBillingEvent(supabase, {
      event,
      outcome: 'error',
      message: requestLoadError.message,
    })
    return Response.json({ ok: false, message: requestLoadError.message }, { status: 500 })
  }

  const activationTarget = resolveUpgradeActivationTarget(toActivationRequestSource(requestRow as UpgradeRequestActivationRow | null))

  if (!activationTarget.ok) {
    if (activationTarget.message === 'This request has already been activated.') {
      await recordStripeBillingEvent(supabase, {
        event,
        outcome: 'ignored',
        message: activationTarget.message,
      })
      return Response.json({ ok: true, ignored: true, message: activationTarget.message })
    }

    await recordStripeBillingEvent(supabase, {
      event,
      outcome: 'error',
      message: activationTarget.message,
    })
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
    await recordStripeBillingEvent(supabase, {
      event,
      outcome: 'error',
      message: profileError.message,
      profileId: activationTarget.userId,
      planId: activationTarget.planId,
      resultingStatus: 'active',
    })
    return Response.json({ ok: false, message: profileError.message }, { status: 500 })
  }

  const { error: requestError } = await supabase
    .from('upgrade_requests')
    .update({ status: 'converted' })
    .eq('id', activationTarget.requestId)

  if (requestError) {
    await recordStripeBillingEvent(supabase, {
      event,
      outcome: 'error',
      message: requestError.message,
      profileId: activationTarget.userId,
      planId: activationTarget.planId,
      resultingStatus: 'active',
    })
    return Response.json({ ok: false, message: requestError.message }, { status: 500 })
  }

  await recordStripeBillingEvent(supabase, {
    event,
    outcome: 'handled',
    profileId: activationTarget.userId,
    planId: activationTarget.planId,
    resultingStatus: activationTarget.planId === 'league' ? null : 'active',
  })

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

async function recordStripeBillingEvent(
  supabase: SupabaseBillingAuditInserter,
  input: Parameters<typeof buildStripeBillingEventAuditPayload>[0],
) {
  const payload = buildStripeBillingEventAuditPayload(input)
  if (!payload) return

  try {
    await supabase
      .from('stripe_billing_events')
      .upsert(payload, { onConflict: 'stripe_event_id' })
  } catch {
    // Audit writes are best-effort; profile access updates remain the source of truth.
  }
}
