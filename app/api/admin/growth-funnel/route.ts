import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildFollowGrowthCohort, type FollowAccessRequest } from '@/lib/follow-growth'
import { buildGrowthCohort, type GrowthEvent, type StripeBillingEvent as CohortBillingEvent } from '@/lib/growth-cohort'
import {
  buildCaptainPilotActivation,
  buildCaptainPilotActivationFollowUps,
  buildCaptainPilotClaimFollowUps,
  buildCaptainPilotFunnel,
  buildCaptainPilotFollowUps,
  buildCaptainPilotSourceBreakdown,
  getCaptainPilotUnclaimedSignupProfileIds,
  type CaptainPilotAvailabilityRow,
  type CaptainPilotLineupDraftRow,
  type CaptainPilotRedemptionRow,
  type CaptainPilotSignupIdentity,
  type CaptainPilotTeamLinkRow,
  type GrowthEventRow,
} from '@/lib/admin-growth-funnel'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import {
  buildScorecardSignupFunnel,
  getScorecardSignupIds,
  type ScorecardSignupIdentity,
  type ScorecardSignupProfile,
} from '@/lib/scorecard-growth-funnel'
import { buildPlayerProfileAcquisitionFunnel, getPlayerProfileSignupIds } from '@/lib/player-profile-growth-funnel'

export const runtime = 'nodejs'

const PERIODS = [7, 30, 90] as const
const EVENT_PAGE_SIZE = 1000
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
  created_at: string
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
  const [events, billingEvents, followRequests, captainPilotResult] = await Promise.all([
    loadGrowthEvents(service, since),
    loadBillingEvents(service, since),
    loadFollowAccessRequests(service, since),
    service
      .from('captain_pilot_redemptions')
      .select('profile_id, status, captain_name, captain_email, team_name, acquisition_source, billing_status, trial_ends_at, updated_at, converted_at')
      .gte('created_at', since)
      .limit(10000),
  ]).catch(() => [null, null, null, null] as const)

  if (!events || !billingEvents || !followRequests) return Response.json({ ok: false, message: 'Growth events could not be loaded.' }, { status: 500 })
  if (!captainPilotResult || captainPilotResult.error) return Response.json({ ok: false, message: 'Captain Pilot conversion could not be loaded.' }, { status: 500 })

  const firstActions = buildGrowthCohort(events.filter((event): event is GrowthEvent & GrowthEventRow => Boolean(event.created_at)), billingEvents as CohortBillingEvent[]).firstActions
  const followJourney = buildFollowGrowthCohort(events.filter((event): event is GrowthEvent & GrowthEventRow => Boolean(event.created_at)), followRequests)
  const captainPilotRows = (captainPilotResult.data ?? []) as CaptainPilotRedemptionRow[]
  const captainPilot = buildCaptainPilotFunnel(
    events,
    captainPilotRows,
  )
  const captainPilotSources = buildCaptainPilotSourceBreakdown(events, captainPilotRows)
  const unclaimedSignupProfileIds = getCaptainPilotUnclaimedSignupProfileIds(events, captainPilotRows)
  const signupIdentities = await loadCaptainPilotSignupIdentities(service, unclaimedSignupProfileIds)
  const scorecardSignupIds = getScorecardSignupIds(events)
  const playerProfileSignupIds = getPlayerProfileSignupIds(events)
  const signupRows = await loadScorecardSignupRows(service, [...new Set([...scorecardSignupIds, ...playerProfileSignupIds])])
  if (!signupRows) {
    return Response.json({ ok: false, message: 'Signup progress could not be loaded.' }, { status: 500 })
  }
  const scorecardSignup = buildScorecardSignupFunnel(
    scorecardSignupIds,
    signupRows.identities,
    signupRows.profiles,
  )
  const playerProfileAcquisition = buildPlayerProfileAcquisitionFunnel(events, signupRows.identities, signupRows.profiles)
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
    ...buildCaptainPilotClaimFollowUps(events, captainPilotRows, signupIdentities),
    ...buildCaptainPilotFollowUps(events, captainPilotRows),
    ...captainPilotActivation.followUps,
  ].sort((left, right) => Number(right.urgent) - Number(left.urgent) || right.waitingDays - left.waitingDays)
  const captainPilotFollowUps = allCaptainPilotFollowUps.slice(0, 8)
  const publicActions = new Set(events.filter((event) => event.event_name && !CONVERSION_EVENT_NAMES.has(event.event_name)).map((event) => event.user_id).filter(Boolean)).size
  const signupRequests = uniqueUsers(events, 'signup_confirmation_sent')
  const scorecardShares = uniqueUsers(events, 'scorecard_shared')
  const playerLinks = uniqueUsers(events, 'profile_player_linked')
  const teamConnections = uniqueUsers(events, 'team_connection_accepted')
  const connectedTeamsOpens = uniqueUsers(events, 'connected_teams_opened')
  const teamChatOpens = uniqueUsers(events, 'team_chat_opened')
  const teamChatSenders = uniqueUsers(events, 'team_chat_message_sent')
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
    followJourney,
    funnel: {
      publicActions,
      signupRequests,
      scorecardShares,
      playerLinks,
      teamConnections,
      connectedTeamsOpens,
      teamChatOpens,
      teamChatSenders,
      firstActions,
      checkoutClicks,
      checkoutStarts,
      checkoutFailures,
      paidActivations,
      captainPilot,
      captainPilotSources,
      captainPilotFollowUps,
      captainPilotFollowUpCount: allCaptainPilotFollowUps.length,
      captainPilotActivation: captainPilotActivation.value,
      scorecardSignup,
      playerProfileAcquisition,
    },
  })
}

async function loadScorecardSignupRows(
  service: ReturnType<typeof createGrowthServiceClient>,
  signupIds: string[],
): Promise<{ identities: ScorecardSignupIdentity[]; profiles: ScorecardSignupProfile[] } | null> {
  const identities: ScorecardSignupIdentity[] = []
  const profiles: ScorecardSignupProfile[] = []

  try {
    for (let offset = 0; offset < signupIds.length; offset += 100) {
      const ids = signupIds.slice(offset, offset + 100)
      const { data, error } = await service.from('profiles')
        .select('id,linked_player_id,stripe_subscription_id,player_plus_subscription_active,player_plus_subscription_status,player_plus_access_expires_at')
        .in('id', ids)
      if (error) throw error
      profiles.push(...((data ?? []) as ScorecardSignupProfile[]))
    }

    for (let offset = 0; offset < signupIds.length; offset += 10) {
      const batch = await Promise.all(signupIds.slice(offset, offset + 10).map(async (id) => {
        const { data, error } = await service.auth.admin.getUserById(id)
        if (error && error.status !== 404) throw error
        const claimPlayerId = data.user?.user_metadata?.scorecard_claim_player_id
        return {
          id,
          emailConfirmed: Boolean(data.user?.email_confirmed_at),
          claimPlayerId: typeof claimPlayerId === 'string' ? claimPlayerId : null,
        }
      }))
      identities.push(...batch)
    }
  } catch (error) {
    console.error('Signup progress could not be loaded.', error)
    return null
  }

  return { identities, profiles }
}

async function loadGrowthEvents(service: SupabaseClient, since: string): Promise<GrowthEventRow[]> {
  const events: GrowthEventRow[] = []
  for (let offset = 0; ; offset += EVENT_PAGE_SIZE) {
    const { data, error } = await service.from('product_usage_events')
      .select('user_id, event_name, plan_id, metadata, created_at')
      .gte('created_at', since).order('created_at', { ascending: true })
      .range(offset, offset + EVENT_PAGE_SIZE - 1)
    if (error) throw error
    events.push(...((data ?? []) as GrowthEventRow[]))
    if ((data ?? []).length < EVENT_PAGE_SIZE) return events
  }
}

async function loadBillingEvents(service: SupabaseClient, since: string): Promise<StripeBillingEvent[]> {
  const events: StripeBillingEvent[] = []
  for (let offset = 0; ; offset += EVENT_PAGE_SIZE) {
    const { data, error } = await service.from('stripe_billing_events')
      .select('profile_id, outcome, resulting_status, created_at')
      .gte('created_at', since).order('created_at', { ascending: true })
      .range(offset, offset + EVENT_PAGE_SIZE - 1)
    if (error) throw error
    events.push(...((data ?? []) as StripeBillingEvent[]))
    if ((data ?? []).length < EVENT_PAGE_SIZE) return events
  }
}

async function loadFollowAccessRequests(service: SupabaseClient, since: string): Promise<FollowAccessRequest[]> {
  const requests: FollowAccessRequest[] = []
  for (let offset = 0; ; offset += EVENT_PAGE_SIZE) {
    const { data, error } = await service.from('upgrade_requests')
      .select('requester_user_id, plan_id, next_href, created_at')
      .eq('plan_id', 'player_plus').gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(offset, offset + EVENT_PAGE_SIZE - 1)
    if (error) throw error
    requests.push(...((data ?? []) as FollowAccessRequest[]))
    if ((data ?? []).length < EVENT_PAGE_SIZE) return requests
  }
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

async function loadCaptainPilotSignupIdentities(
  service: ReturnType<typeof createGrowthServiceClient>,
  profileIds: string[],
): Promise<CaptainPilotSignupIdentity[]> {
  return Promise.all(profileIds.slice(0, 100).map(async (profileId) => {
    const { data } = await service.auth.admin.getUserById(profileId)
    const metadata = data.user?.user_metadata && typeof data.user.user_metadata === 'object'
      ? data.user.user_metadata as Record<string, unknown>
      : {}
    const firstName = cleanIdentityLabel(metadata.first_name)
    const fullName = cleanIdentityLabel(metadata.full_name) || cleanIdentityLabel(metadata.name)

    return {
      profileId,
      captainName: fullName || firstName || null,
      captainEmail: data.user?.email || null,
      emailConfirmed: data.user ? Boolean(data.user.email_confirmed_at) : undefined,
    }
  }))
}

function cleanIdentityLabel(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
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
