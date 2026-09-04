import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

const PERIODS = [7, 30, 90] as const

type GrowthEvent = {
  user_id: string | null
  event_name: string | null
}

type StripeBillingEvent = {
  profile_id: string | null
  outcome: string | null
  resulting_status: string | null
}

export async function GET(request: Request) {
  const token = getBearerToken(request)
  if (!token) return Response.json({ ok: false, message: 'Sign in as an admin to review growth.' }, { status: 401 })

  const auth = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: authData, error: authError } = await auth.auth.getUser(token)
  if (authError || !authData.user?.id) {
    return Response.json({ ok: false, message: 'Sign in as an admin to review growth.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return Response.json({ ok: false, message: 'Growth reporting is not configured.' }, { status: 500 })
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: adminProfile, error: profileError } = await service
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle()
  if (profileError || adminProfile?.role !== 'admin') {
    return Response.json({ ok: false, message: 'Admin access is required.' }, { status: 403 })
  }

  const days = normalizePeriod(new URL(request.url).searchParams.get('days'))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const [eventsResult, billingResult] = await Promise.all([
    service
      .from('product_usage_events')
      .select('user_id, event_name')
      .gte('created_at', since)
      .limit(10000),
    service
      .from('stripe_billing_events')
      .select('profile_id, outcome, resulting_status')
      .gte('created_at', since)
      .limit(10000),
  ])

  if (eventsResult.error) return Response.json({ ok: false, message: 'Growth events could not be loaded.' }, { status: 500 })
  if (billingResult.error) return Response.json({ ok: false, message: 'Stripe activation events could not be loaded.' }, { status: 500 })

  const events = (eventsResult.data ?? []) as GrowthEvent[]
  const billingEvents = (billingResult.data ?? []) as StripeBillingEvent[]
  const publicActions = new Set(events.filter((event) => event.event_name && event.event_name !== 'signup_confirmation_sent').map((event) => event.user_id).filter(Boolean)).size
  const signupRequests = uniqueUsers(events, 'signup_confirmation_sent')
  const checkoutStarts = uniqueUsers(events, 'upgrade_checkout_started')
  const paidActivations = new Set(
    billingEvents
      .filter((event) => event.outcome === 'handled' && (event.resulting_status === 'active' || event.resulting_status === 'trial'))
      .map((event) => event.profile_id)
      .filter(Boolean),
  ).size

  return Response.json({
    ok: true,
    days,
    since,
    funnel: {
      publicActions,
      signupRequests,
      checkoutStarts,
      paidActivations,
    },
  })
}

function uniqueUsers(events: GrowthEvent[], eventName: string) {
  return new Set(events.filter((event) => event.event_name === eventName).map((event) => event.user_id).filter(Boolean)).size
}

function normalizePeriod(value: string | null): (typeof PERIODS)[number] {
  const numeric = Number(value)
  return PERIODS.includes(numeric as (typeof PERIODS)[number]) ? numeric as (typeof PERIODS)[number] : 30
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization')
  return header?.toLowerCase().startsWith('bearer ') ? header.slice('bearer '.length).trim() : ''
}
