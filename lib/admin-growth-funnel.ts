import {
  CAPTAIN_PILOT_SOURCES,
  CAPTAIN_PILOT_SOURCE_LABELS,
  normalizeCaptainPilotSource,
  type CaptainPilotSource,
} from '@/lib/captain-pilot-source'

export type GrowthEventRow = {
  user_id: string | null
  event_name: string | null
  plan_id: string | null
  metadata: Record<string, unknown> | null
  created_at?: string | null
}

export type CaptainPilotRedemptionRow = {
  profile_id: string | null
  status: string | null
  captain_name?: string | null
  captain_email?: string | null
  team_name?: string | null
  acquisition_source?: string | null
  updated_at?: string | null
  converted_at?: string | null
  trial_ends_at?: string | null
  billing_status?: string | null
}

export type CaptainPilotFunnel = {
  offerViews: number
  tourStarts: number
  signupRequests: number
  offerActions: number
  claims: number
  checkoutStarts: number
  checkoutFailures: number
  activations: number
  billingConnected: number
}

export type CaptainPilotSourceBreakdown = {
  source: CaptainPilotSource
  label: string
  offerViews: number
  signupRequests: number
  claims: number
  activations: number
  billingConnected: number
}

export type CaptainPilotFollowUp = {
  profileId: string
  captainName: string
  captainEmail: string
  teamName: string
  stage: 'checkout' | 'team_connection' | 'first_week' | 'first_share' | 'billing'
  reason: string
  nextStep: string
  waitingDays: number
  daysRemaining?: number
  urgent: boolean
}

export type CaptainPilotTeamLinkRow = {
  profile_user_id: string | null
  team_role?: string | null
  team_roles?: string[] | null
}

export type CaptainPilotLineupDraftRow = {
  user_id: string | null
  slots_json: unknown
  delivery_status?: string | null
}

export type CaptainPilotAvailabilityRow = {
  created_by: string | null
}

export type CaptainPilotActivation = {
  activations: number
  teamConnected: number
  lineupStarted: number
  availabilitySent: number
  firstValue: number
  lineupShared: number
}

export function buildCaptainPilotFunnel(
  events: GrowthEventRow[],
  redemptions: CaptainPilotRedemptionRow[],
): CaptainPilotFunnel {
  return {
    offerViews: uniqueEventUsers(events, (event) => event.event_name === 'captain_pilot_viewed'),
    tourStarts: uniqueEventUsers(events, (event) => (
      event.event_name === 'product_tour_started'
      && event.metadata?.videoId === 'captain'
      && event.metadata?.source === 'captain-pilot'
    )),
    signupRequests: uniqueEventUsers(events, (event) => (
      event.event_name === 'signup_confirmation_sent'
      && event.plan_id === 'captain'
      && event.metadata?.signup_intent === 'captain-pilot'
    )),
    offerActions: uniqueEventUsers(events, (event) => event.event_name === 'captain_pilot_cta_clicked'),
    claims: uniqueProfiles(redemptions),
    checkoutStarts: uniqueProfiles(redemptions.filter((row) => row.billing_status === 'checkout_started' || row.billing_status === 'collected')),
    checkoutFailures: uniqueEventUsers(events, (event) => (
      event.event_name === 'upgrade_checkout_failed'
      && event.plan_id === 'captain'
      && event.metadata?.source === 'captain_pilot'
    )),
    activations: uniqueProfiles(redemptions.filter((row) => row.status === 'converted')),
    billingConnected: uniqueProfiles(redemptions.filter((row) => row.billing_status === 'collected')),
  }
}

export function buildCaptainPilotSourceBreakdown(
  events: GrowthEventRow[],
  redemptions: CaptainPilotRedemptionRow[],
): CaptainPilotSourceBreakdown[] {
  const sourceByProfile = buildCaptainPilotSourceMap(events)
  redemptions.forEach((redemption) => {
    if (!redemption.profile_id) return
    const redemptionSource = normalizeCaptainPilotSource(redemption.acquisition_source)
    const existing = sourceByProfile.get(redemption.profile_id)
    if (!existing || existing === 'direct') sourceByProfile.set(redemption.profile_id, redemptionSource)
  })
  const rows = new Map<CaptainPilotSource, CaptainPilotSourceBreakdown>(
    CAPTAIN_PILOT_SOURCES.map((source) => [source, {
      source,
      label: CAPTAIN_PILOT_SOURCE_LABELS[source],
      offerViews: 0,
      signupRequests: 0,
      claims: 0,
      activations: 0,
      billingConnected: 0,
    }]),
  )

  incrementUniqueProfiles(rows, sourceByProfile, events
    .filter((event) => event.event_name === 'captain_pilot_viewed')
    .map((event) => event.user_id), 'offerViews')
  incrementUniqueProfiles(rows, sourceByProfile, events
    .filter((event) => (
      event.event_name === 'signup_confirmation_sent'
      && event.plan_id === 'captain'
      && event.metadata?.signup_intent === 'captain-pilot'
    ))
    .map((event) => event.user_id), 'signupRequests')
  incrementUniqueProfiles(rows, sourceByProfile, redemptions.map((row) => row.profile_id), 'claims')
  incrementUniqueProfiles(rows, sourceByProfile, redemptions
    .filter((row) => row.status === 'converted')
    .map((row) => row.profile_id), 'activations')
  incrementUniqueProfiles(rows, sourceByProfile, redemptions
    .filter((row) => row.billing_status === 'collected')
    .map((row) => row.profile_id), 'billingConnected')

  return CAPTAIN_PILOT_SOURCES.map((source) => rows.get(source) as CaptainPilotSourceBreakdown)
}

export function buildCaptainPilotFollowUps(
  events: GrowthEventRow[],
  redemptions: CaptainPilotRedemptionRow[],
  now = Date.now(),
): CaptainPilotFollowUp[] {
  const failedProfiles = new Set(
    events
      .filter((event) => (
        event.event_name === 'upgrade_checkout_failed'
        && event.plan_id === 'captain'
        && event.metadata?.source === 'captain_pilot'
      ))
      .map((event) => event.user_id)
      .filter((profileId): profileId is string => Boolean(profileId)),
  )

  return redemptions
    .flatMap((row) => {
      if (!row.profile_id || (row.status !== 'claimed' && row.status !== 'checkout_started')) return []
      const updatedAt = row.updated_at ? Date.parse(row.updated_at) : Number.NaN
      const waitingDays = Number.isFinite(updatedAt)
        ? Math.max(0, Math.floor((now - updatedAt) / (24 * 60 * 60 * 1000)))
        : 0
      const urgent = failedProfiles.has(row.profile_id)
      if (!urgent && waitingDays < 1) return []

      return [{
        profileId: row.profile_id,
        captainName: cleanLabel(row.captain_name, 'Captain'),
        captainEmail: cleanLabel(row.captain_email),
        teamName: cleanLabel(row.team_name, 'Team not added'),
        stage: 'checkout',
        reason: urgent
          ? 'Checkout error recorded'
          : row.status === 'checkout_started'
            ? 'Checkout opened, access not active'
            : 'Pilot claimed, checkout not opened',
        nextStep: urgent
          ? 'Ask what blocked checkout.'
          : row.status === 'checkout_started'
            ? 'Send a short checkout reminder.'
            : 'Invite them back to finish activation.',
        waitingDays,
        urgent,
      } satisfies CaptainPilotFollowUp]
    })
    .sort((left, right) => Number(right.urgent) - Number(left.urgent) || right.waitingDays - left.waitingDays)
}

export function buildCaptainPilotActivation(
  activatedProfileIds: string[],
  teamLinks: CaptainPilotTeamLinkRow[],
  lineupDrafts: CaptainPilotLineupDraftRow[],
  availabilityRequests: CaptainPilotAvailabilityRow[],
): CaptainPilotActivation {
  const { activated, connectedProfiles, lineupProfiles, availabilityProfiles, sharedProfiles } = buildActivationProfileSets(
    activatedProfileIds,
    teamLinks,
    lineupDrafts,
    availabilityRequests,
  )

  return {
    activations: activated.size,
    teamConnected: connectedProfiles.size,
    lineupStarted: lineupProfiles.size,
    availabilitySent: availabilityProfiles.size,
    firstValue: new Set([...lineupProfiles, ...availabilityProfiles]).size,
    lineupShared: sharedProfiles.size,
  }
}

export function buildCaptainPilotActivationFollowUps(
  redemptions: CaptainPilotRedemptionRow[],
  teamLinks: CaptainPilotTeamLinkRow[],
  lineupDrafts: CaptainPilotLineupDraftRow[],
  availabilityRequests: CaptainPilotAvailabilityRow[],
  now = Date.now(),
): CaptainPilotFollowUp[] {
  const activatedRows = redemptions.filter((row) => row.status === 'converted' && row.profile_id)
  const activatedProfileIds = activatedRows.map((row) => row.profile_id as string)
  const { connectedProfiles, lineupProfiles, availabilityProfiles, sharedProfiles } = buildActivationProfileSets(
    activatedProfileIds,
    teamLinks,
    lineupDrafts,
    availabilityRequests,
  )

  return activatedRows.flatMap((row): CaptainPilotFollowUp[] => {
    const profileId = row.profile_id as string
    const completedAt = row.converted_at || row.updated_at
    const completedAtMs = completedAt ? Date.parse(completedAt) : Number.NaN
    const waitingDays = Number.isFinite(completedAtMs)
      ? Math.max(0, Math.floor((now - completedAtMs) / (24 * 60 * 60 * 1000)))
      : 0
    if (waitingDays < 1) return []

    const common = {
      profileId,
      captainName: cleanLabel(row.captain_name, 'Captain'),
      captainEmail: cleanLabel(row.captain_email),
      teamName: cleanLabel(row.team_name, 'Team not added'),
      waitingDays,
      urgent: false,
    }
    const trialEndsAtMs = row.trial_ends_at ? Date.parse(row.trial_ends_at) : Number.NaN
    const daysRemaining = Number.isFinite(trialEndsAtMs)
      ? Math.ceil((trialEndsAtMs - now) / (24 * 60 * 60 * 1000))
      : null
    if (row.billing_status !== 'collected' && daysRemaining !== null && daysRemaining <= 30) {
      return [{
        ...common,
        stage: 'billing',
        reason: daysRemaining <= 0
          ? 'Free Captain access ended without billing'
          : `Free Captain access ends in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`,
        nextStep: 'Invite them to add billing if they want to continue.',
        daysRemaining,
        urgent: daysRemaining <= 7,
      } satisfies CaptainPilotFollowUp]
    }
    if (!connectedProfiles.has(profileId)) {
      return [{
        ...common,
        stage: 'team_connection',
        reason: 'Active, but no captain team is connected',
        nextStep: 'Guide them back to team setup.',
      } satisfies CaptainPilotFollowUp]
    }
    if (!lineupProfiles.has(profileId) && !availabilityProfiles.has(profileId)) {
      return [{
        ...common,
        stage: 'first_week',
        reason: 'Team connected, but no first week started',
        nextStep: 'Guide them to availability or lineup building.',
      } satisfies CaptainPilotFollowUp]
    }
    if (lineupProfiles.has(profileId) && !sharedProfiles.has(profileId)) {
      return [{
        ...common,
        stage: 'first_share',
        reason: 'First lineup saved, but not shared',
        nextStep: 'Guide them to send the plan to their team.',
      } satisfies CaptainPilotFollowUp]
    }
    return []
  })
}

function uniqueEventUsers(events: GrowthEventRow[], predicate: (event: GrowthEventRow) => boolean) {
  return new Set(events.filter(predicate).map((event) => event.user_id).filter(Boolean)).size
}

function uniqueProfiles(rows: CaptainPilotRedemptionRow[]) {
  return new Set(rows.map((row) => row.profile_id).filter(Boolean)).size
}

function buildCaptainPilotSourceMap(events: GrowthEventRow[]) {
  const sourceByProfile = new Map<string, CaptainPilotSource>()
  const orderedEvents = [...events].sort((left, right) => timestamp(left.created_at) - timestamp(right.created_at))
  orderedEvents.forEach((event) => {
    if (!event.user_id) return
    const source = normalizeCaptainPilotSource(event.metadata?.acquisitionSource)
    const existing = sourceByProfile.get(event.user_id)
    if (!existing || (existing === 'direct' && source !== 'direct')) sourceByProfile.set(event.user_id, source)
  })
  return sourceByProfile
}

function incrementUniqueProfiles(
  rows: Map<CaptainPilotSource, CaptainPilotSourceBreakdown>,
  sourceByProfile: Map<string, CaptainPilotSource>,
  profileIds: Array<string | null>,
  field: 'offerViews' | 'signupRequests' | 'claims' | 'activations' | 'billingConnected',
) {
  new Set(profileIds.filter((profileId): profileId is string => Boolean(profileId))).forEach((profileId) => {
    const source = sourceByProfile.get(profileId) ?? 'direct'
    const row = rows.get(source)
    if (row) row[field] += 1
  })
}

function timestamp(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

function cleanLabel(value: string | null | undefined, fallback = '') {
  const cleaned = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return cleaned || fallback
}

function profileSet(profileIds: Array<string | null>, allowedProfiles: Set<string>) {
  return new Set(profileIds.filter((profileId): profileId is string => Boolean(profileId && allowedProfiles.has(profileId))))
}

function buildActivationProfileSets(
  activatedProfileIds: string[],
  teamLinks: CaptainPilotTeamLinkRow[],
  lineupDrafts: CaptainPilotLineupDraftRow[],
  availabilityRequests: CaptainPilotAvailabilityRow[],
) {
  const activated = new Set(activatedProfileIds.filter(Boolean))
  const connectedProfiles = profileSet(
    teamLinks.filter(hasCaptainTeamRole).map((row) => row.profile_user_id),
    activated,
  )
  const lineupProfiles = profileSet(
    lineupDrafts.filter((row) => hasAssignedPlayer(row.slots_json)).map((row) => row.user_id),
    activated,
  )
  const availabilityProfiles = profileSet(availabilityRequests.map((row) => row.created_by), activated)
  const sharedProfiles = profileSet(
    lineupDrafts
      .filter((row) => row.delivery_status === 'sent' && hasAssignedPlayer(row.slots_json))
      .map((row) => row.user_id),
    activated,
  )
  return { activated, connectedProfiles, lineupProfiles, availabilityProfiles, sharedProfiles }
}

function hasAssignedPlayer(value: unknown) {
  if (!Array.isArray(value)) return false
  return value.some((slot) => {
    if (!slot || typeof slot !== 'object') return false
    const players = (slot as Record<string, unknown>).players
    if (!Array.isArray(players)) return false
    return players.some((player) => {
      if (!player || typeof player !== 'object') return false
      const entry = player as Record<string, unknown>
      return Boolean(cleanLabel(typeof entry.playerId === 'string' ? entry.playerId : '') || cleanLabel(typeof entry.playerName === 'string' ? entry.playerName : ''))
    })
  })
}

function hasCaptainTeamRole(row: CaptainPilotTeamLinkRow) {
  const roles = Array.isArray(row.team_roles) && row.team_roles.length
    ? row.team_roles
    : [row.team_role]
  return roles.some((role) => role === 'captain' || role === 'co_captain')
}
