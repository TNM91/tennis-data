export type GrowthEventRow = {
  user_id: string | null
  event_name: string | null
  plan_id: string | null
  metadata: Record<string, unknown> | null
}

export type CaptainPilotRedemptionRow = {
  profile_id: string | null
  status: string | null
  captain_name?: string | null
  captain_email?: string | null
  team_name?: string | null
  updated_at?: string | null
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
}

export type CaptainPilotFollowUp = {
  profileId: string
  captainName: string
  captainEmail: string
  teamName: string
  status: 'claimed' | 'checkout_started'
  reason: string
  nextStep: string
  waitingDays: number
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
    checkoutStarts: uniqueProfiles(redemptions.filter((row) => row.status === 'checkout_started' || row.status === 'converted')),
    checkoutFailures: uniqueEventUsers(events, (event) => (
      event.event_name === 'upgrade_checkout_failed'
      && event.plan_id === 'captain'
      && event.metadata?.source === 'captain_pilot'
    )),
    activations: uniqueProfiles(redemptions.filter((row) => row.status === 'converted')),
  }
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
        status: row.status,
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

  return {
    activations: activated.size,
    teamConnected: connectedProfiles.size,
    lineupStarted: lineupProfiles.size,
    availabilitySent: availabilityProfiles.size,
    firstValue: new Set([...lineupProfiles, ...availabilityProfiles]).size,
  }
}

function uniqueEventUsers(events: GrowthEventRow[], predicate: (event: GrowthEventRow) => boolean) {
  return new Set(events.filter(predicate).map((event) => event.user_id).filter(Boolean)).size
}

function uniqueProfiles(rows: CaptainPilotRedemptionRow[]) {
  return new Set(rows.map((row) => row.profile_id).filter(Boolean)).size
}

function cleanLabel(value: string | null | undefined, fallback = '') {
  const cleaned = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return cleaned || fallback
}

function profileSet(profileIds: Array<string | null>, allowedProfiles: Set<string>) {
  return new Set(profileIds.filter((profileId): profileId is string => Boolean(profileId && allowedProfiles.has(profileId))))
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
