import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import {
  findStripeCustomerIdForUser,
  isStripeBillingProfileColumnError,
  type StripeBillingCheckoutSession,
} from '@/lib/stripe-billing'

export const runtime = 'nodejs'

type ProfileBillingRow = {
  stripe_customer_id?: string | null
}

type SupabaseProfileReader = {
  from(table: 'profiles'): {
    select(columns: 'stripe_customer_id'): {
      eq(column: 'id', value: string): {
        maybeSingle(): PromiseLike<{
          data: ProfileBillingRow | null
          error: { code?: string; message?: string } | null
        }>
      }
    }
  }
}

const STRIPE_API_VERSION = '2026-04-22.dahlia'

export async function POST(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in to manage billing.' }, { status: 401 })
  }

  const userResult = await getRequesterUser(token)
  if (!userResult.userId) {
    return Response.json({ ok: false, message: 'Sign in to manage billing.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return Response.json(
      { ok: false, message: 'Billing management is missing Supabase service access.' },
      { status: 500 },
    )
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!stripeSecretKey) {
    return Response.json(
      { ok: false, message: 'Billing management is not configured yet.' },
      { status: 500 },
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }) as unknown as SupabaseProfileReader
  let profileCustomerId = ''
  try {
    profileCustomerId = await getStoredStripeCustomerId(supabase, userResult.userId)
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : 'Billing profile could not be loaded.' },
      { status: 500 },
    )
  }
  const fallbackCustomerId = profileCustomerId
    ? ''
    : findStripeCustomerIdForUser(
        await listRecentStripeCheckoutSessions(stripeSecretKey),
        { userId: userResult.userId, email: userResult.email },
      )
  const customerId = profileCustomerId || fallbackCustomerId

  if (!customerId) {
    return Response.json(
      { ok: false, message: 'No Stripe billing customer found for this account yet.' },
      { status: 404 },
    )
  }

  const params = new URLSearchParams()
  params.set('customer', customerId)
  params.set('return_url', new URL('/profile?billing=returned', request.url).toString())

  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
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
      { ok: false, message: stripeBody?.error?.message || 'Stripe billing portal could not be opened.' },
      { status: response.ok ? 500 : response.status },
    )
  }

  return Response.json({ ok: true, url: stripeBody.url })
}

async function getStoredStripeCustomerId(
  supabase: SupabaseProfileReader,
  userId: string,
) {
  const { data, error } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()

  if (error && !isStripeBillingProfileColumnError(error)) {
    throw new Error(error.message)
  }

  return ((data ?? null) as ProfileBillingRow | null)?.stripe_customer_id?.trim() ?? ''
}

async function listRecentStripeCheckoutSessions(stripeSecretKey: string) {
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions?limit=100', {
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Stripe-Version': STRIPE_API_VERSION,
    },
  })
  if (!response.ok) return []
  const body = (await response.json()) as { data?: StripeBillingCheckoutSession[] }
  return Array.isArray(body.data) ? body.data : []
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

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}
