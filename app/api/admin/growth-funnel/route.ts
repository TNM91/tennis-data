import { createClient } from '@supabase/supabase-js'
import {
  buildCaptainPilotActivation,
  buildCaptainPilotActivationFollowUps,
  buildCaptainPilotFunnel,
  buildCaptainPilotFollowUps,
  buildCaptainPilotSourceBreakdown,
  type CaptainPilotAvailabilityRow,
  type CaptainPilotLineupDraftRow,
  type CaptainPilotRedemptionRow,
  type CaptainPilotTeamLinkRow,
  type GrowthEventRow,
} from '@/lib/admin-growth-funnel'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

const PERIODS = [7, 30, 90] as const
const CONVERSION_EVENT_NAMES = new Set([
  'signup_confirmation_sent',
  'upgrade_page_viewed',
  'upgrade_checkout_clicked',
  'upgrade_checkout_started',
  'upgrade_checkout_failed',
  'captain_pilot_viewed',
  'captain_pilot_cta_clicked',
  'captain_pilot_team_preview_viewed',
  'captain_pilot_claimed',
  'captain_pilot_card_free_activated',
  'captain_pilot_activation_failed',
  'captain_pilot_billing_clicked',
  'product_tour_started',
])

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
  const service = createGrowthServiceClient(serviceKey)
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
  const [eventsResult, billingResult, captainPilotResult] = await Promise.all([
    service
      .from('product_usage_events')
      .select('user_id, event_name, plan_id, metadata, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(10000),
    service
      .from('stripe_billing_events')
      .select('profile_id, outcome, resulting_status')
      .gte('created_at', since)
      .limit(10000),
    service
      .from('captain_pilot_redemptions')
      .select('profile_id, status, captain_name, captain_email, team_name, acquisition_source, billing_status, trial_ends_at, updated_at, converted_at')
      .gte('created_at', since)
      .limit(10000),
  ])

  if (eventsResult.error) return Response.json({ ok: false, message: 'Growth events could not be loaded.' }, { status: 500 })
  if (billingResult.error) return Response.json({ ok: false, message: 'Stripe activation events could not be loaded.' }, { status: 500 })
  if (captainPilotResult.error) return Response.json({ ok: false, message: 'Captain Pilot conversion could not be loaded.' }, { status: 500 })

  const events = (eventsResult.data ?? []) as GrowthEventRow[]
  const billingEvents = (billingResult.data ?? []) as StripeBillingEvent[]
  const captainPilotRows = (captainPilotResult.data ?? []) as CaptainPilotRedemptionRow[]
  const captainPilot = buildCaptainPilotFunnel(
    events,
    captainPilotRows,
  )
  const captainPilotSources = buildCaptainPilotSourceBreakdown(events, captainPilotRows)
  const activatedProfileIds = [...new Set(
    captainPilotRows
      .filter((row) => row.status === 'converted')
      .map((row) => row.profile_id)
      .filter((profileId): profileId is string => Boolean(profileId)),
  )]
  const captainPilotActivation = await loadCaptainPilotActivation(service, activatedProfileIds, captainPilotRows)
  if (!captainPilotActivation.ok) {
    return Response.json({ ok: false, message: 'Captain activation progress could not be loaded.' }, { status: 500 })
  }
  const allCaptainPilotFollowUps = [
    ...buildCaptainPilotFollowUps(events, captainPilotRows),
    ...captainPilotActivation.followUps,
  ].sort((left, right) => Number(right.urgent) - Number(left.urgent) || right.waitingDays - left.waitingDays)
  const captainPilotFollowUps = allCaptainPilotFollowUps.slice(0, 8)
  const publicActions = new Set(events.filter((event) => event.event_name && !CONVERSION_EVENT_NAMES.has(event.event_name)).map((event) => event.user_id).filter(Boolean)).size
  const signupRequests = uniqueUsers(events, 'signup_confirmation_sent')
  const checkoutClicks = uniqueUsers(events, 'upgrade_checkout_clicked')
  const checkoutStarts = uniqueUsers(events, 'upgrade_checkout_started')
  const checkoutFailures = uniqueUsers(events, 'upgrade_checkout_failed')
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
      checkoutClicks,
      checkoutStarts,
      checkoutFailures,
      paidActivations,
      captainPilot,
      captainPilotSources,
      captainPilotFollowUps,
      captainPilotFollowUpCount: allCaptainPilotFollowUps.length,
      captainPilotActivation: captainPilotActivation.value,
    },
  })
}

async function loadCaptainPilotActivation(
  service: ReturnType<typeof createGrowthServiceClient>,
  profileIds: string[],
  redemptions: CaptainPilotRedemptionRow[],
) {
  if (!profileIds.length) {
    return {
      ok: true as const,
      value: buildCaptainPilotActivation([], [], [], []),
      followUps: [],
    }
  }

  const [teamLinksResult, lineupDraftsResult, availabilityResult] = await Promise.all([
    service
      .from('team_profile_links')
      .select('profile_user_id, team_role, team_roles')
      .in('profile_user_id', profileIds)
      .eq('status', 'accepted')
      .is('archived_at', null)
      .limit(10000),
    service
      .from('captain_lineup_drafts')
      .select('user_id, slots_json, delivery_status')
      .in('user_id', profileIds)
      .limit(10000),
    service
      .from('captain_availability_requests')
      .select('created_by')
      .in('created_by', profileIds)
      .limit(10000),
  ])

  if (teamLinksResult.error || lineupDraftsResult.error || availabilityResult.error) {
    return { ok: false as const }
  }

  return {
    ok: true as const,
    value: buildCaptainPilotActivation(
      profileIds,
      (teamLinksResult.data ?? []) as CaptainPilotTeamLinkRow[],
      (lineupDraftsResult.data ?? []) as CaptainPilotLineupDraftRow[],
      (availabilityResult.data ?? []) as CaptainPilotAvailabilityRow[],
    ),
    followUps: buildCaptainPilotActivationFollowUps(
      redemptions,
      (teamLinksResult.data ?? []) as CaptainPilotTeamLinkRow[],
      (lineupDraftsResult.data ?? []) as CaptainPilotLineupDraftRow[],
      (availabilityResult.data ?? []) as CaptainPilotAvailabilityRow[],
    ),
  }
}

function createGrowthServiceClient(serviceKey: string) {
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function uniqueUsers(events: GrowthEventRow[], eventName: string) {
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
