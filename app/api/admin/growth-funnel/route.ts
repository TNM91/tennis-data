import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { buildGrowthCohort, type GrowthEvent, type StripeBillingEvent } from '@/lib/growth-cohort'
import { buildFollowGrowthCohort, type FollowAccessRequest } from '@/lib/follow-growth'

export const runtime = 'nodejs'

const PERIODS = [7, 30, 90] as const
const EVENT_PAGE_SIZE = 1000

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
  let funnel: ReturnType<typeof buildGrowthCohort>
  let followJourney: ReturnType<typeof buildFollowGrowthCohort>
  try {
    const [events, billingEvents, followRequests] = await Promise.all([
      loadGrowthEvents(service, since),
      loadBillingEvents(service, since),
      loadFollowAccessRequests(service, since),
    ])
    funnel = buildGrowthCohort(events, billingEvents)
    followJourney = buildFollowGrowthCohort(events, followRequests)
  } catch {
    return Response.json({ ok: false, message: 'Growth events could not be loaded.' }, { status: 500 })
  }
  return Response.json({
    ok: true,
    days,
    since,
    funnel,
    followJourney,
  })
}

async function loadGrowthEvents(service: SupabaseClient, since: string): Promise<GrowthEvent[]> {
  const events: GrowthEvent[] = []
  for (let offset = 0; ; offset += EVENT_PAGE_SIZE) {
    const { data, error } = await service
      .from('product_usage_events')
      .select('user_id, event_name, plan_id, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(offset, offset + EVENT_PAGE_SIZE - 1)
    if (error) throw error
    events.push(...((data ?? []) as GrowthEvent[]))
    if ((data ?? []).length < EVENT_PAGE_SIZE) return events
  }
}

async function loadBillingEvents(service: SupabaseClient, since: string): Promise<StripeBillingEvent[]> {
  const events: StripeBillingEvent[] = []
  for (let offset = 0; ; offset += EVENT_PAGE_SIZE) {
    const { data, error } = await service
      .from('stripe_billing_events')
      .select('profile_id, outcome, resulting_status, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(offset, offset + EVENT_PAGE_SIZE - 1)
    if (error) throw error
    events.push(...((data ?? []) as StripeBillingEvent[]))
    if ((data ?? []).length < EVENT_PAGE_SIZE) return events
  }
}

async function loadFollowAccessRequests(service: SupabaseClient, since: string): Promise<FollowAccessRequest[]> {
  const requests: FollowAccessRequest[] = []
  for (let offset = 0; ; offset += EVENT_PAGE_SIZE) {
    const { data, error } = await service
      .from('upgrade_requests')
      .select('requester_user_id, plan_id, next_href, created_at')
      .eq('plan_id', 'player_plus')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(offset, offset + EVENT_PAGE_SIZE - 1)
    if (error) throw error
    requests.push(...((data ?? []) as FollowAccessRequest[]))
    if ((data ?? []).length < EVENT_PAGE_SIZE) return requests
  }
}

function normalizePeriod(value: string | null): (typeof PERIODS)[number] {
  const numeric = Number(value)
  return PERIODS.includes(numeric as (typeof PERIODS)[number]) ? numeric as (typeof PERIODS)[number] : 30
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization')
  return header?.toLowerCase().startsWith('bearer ') ? header.slice('bearer '.length).trim() : ''
}
