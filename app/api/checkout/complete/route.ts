import { createClient } from '@supabase/supabase-js'
import { buildProfileActivationPayload, resolveUpgradeActivationTarget } from '@/lib/upgrade-activation'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import {
  findPaidStripeCheckoutSessionForRequest,
  isPaidStripeCheckoutSessionForRequest,
  type StripeCheckoutCompletionSession,
} from '@/lib/stripe-session-verification'

export const runtime = 'nodejs'

type CheckoutCompletionBody = {
  requestId?: unknown
  sessionId?: unknown
}

type UpgradeRequestActivationRow = {
  id: string
  plan_id: string | null
  requester_user_id: string | null
  status: string | null
}

const STRIPE_API_VERSION = '2026-04-22.dahlia'

export async function POST(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in before confirming checkout.' }, { status: 401 })
  }

  let body: CheckoutCompletionBody
  try {
    body = (await request.json()) as CheckoutCompletionBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid checkout confirmation.' }, { status: 400 })
  }

  const requestId = cleanString(body.requestId)
  const sessionId = cleanString(body.sessionId)
  if (!requestId) {
    return Response.json({ ok: false, message: 'Missing upgrade request id.' }, { status: 400 })
  }

  const userResult = await getRequesterUser(token)
  if (!userResult.userId) {
    return Response.json({ ok: false, message: 'Sign in before confirming checkout.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return Response.json({ ok: false, message: 'Supabase service access is not configured.' }, { status: 500 })
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeSecretKey) {
    return Response.json({ ok: false, message: 'Checkout confirmation is not configured.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
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
      return Response.json({ ok: true, activated: true, alreadyActive: true })
    }

    return Response.json(
      { ok: false, message: activationTarget.message },
      { status: activationTarget.status },
    )
  }

  if (activationTarget.userId !== userResult.userId) {
    return Response.json({ ok: false, message: 'This checkout belongs to another account.' }, { status: 403 })
  }

  const stripeSession = await findVerifiedStripeSession({
    stripeSecretKey,
    requestId: activationTarget.requestId,
    userId: activationTarget.userId,
    sessionId,
  })

  if (!stripeSession) {
    return Response.json({ ok: false, message: 'Paid checkout session was not found yet.' }, { status: 409 })
  }

  const profilePayload = buildProfileActivationPayload(activationTarget.planId)
  const { error: profileError } = await supabase
    .from('profiles')
    .update(profilePayload)
    .eq('id', activationTarget.userId)

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

  return Response.json({ ok: true, activated: activationTarget.planId, sessionId: stripeSession.id })
}

async function findVerifiedStripeSession({
  stripeSecretKey,
  requestId,
  userId,
  sessionId,
}: {
  stripeSecretKey: string
  requestId: string
  userId: string
  sessionId: string
}) {
  if (sessionId) {
    const session = await fetchStripeCheckoutSession(stripeSecretKey, sessionId)
    return isPaidStripeCheckoutSessionForRequest(session, { requestId, userId }) ? session : null
  }

  const sessions = await listRecentStripeCheckoutSessions(stripeSecretKey)
  return findPaidStripeCheckoutSessionForRequest(sessions, { requestId, userId })
}

async function fetchStripeCheckoutSession(stripeSecretKey: string, sessionId: string) {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: stripeHeaders(stripeSecretKey),
  })
  if (!response.ok) return null
  return (await response.json()) as StripeCheckoutCompletionSession
}

async function listRecentStripeCheckoutSessions(stripeSecretKey: string) {
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions?limit=100', {
    headers: stripeHeaders(stripeSecretKey),
  })
  if (!response.ok) return []
  const body = (await response.json()) as { data?: StripeCheckoutCompletionSession[] }
  return Array.isArray(body.data) ? body.data : []
}

function stripeHeaders(stripeSecretKey: string) {
  return {
    Authorization: `Bearer ${stripeSecretKey}`,
    'Stripe-Version': STRIPE_API_VERSION,
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

function toActivationRequestSource(row: UpgradeRequestActivationRow | null) {
  if (!row) return null

  return {
    id: String(row.id),
    planId: typeof row.plan_id === 'string' ? row.plan_id : null,
    userId: typeof row.requester_user_id === 'string' ? row.requester_user_id : null,
    status: typeof row.status === 'string' ? row.status : null,
  }
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
