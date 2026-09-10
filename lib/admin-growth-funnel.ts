export type GrowthEventRow = {
  user_id: string | null
  event_name: string | null
  plan_id: string | null
  metadata: Record<string, unknown> | null
}

export type CaptainPilotRedemptionRow = {
  profile_id: string | null
  status: string | null
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

function uniqueEventUsers(events: GrowthEventRow[], predicate: (event: GrowthEventRow) => boolean) {
  return new Set(events.filter(predicate).map((event) => event.user_id).filter(Boolean)).size
}

function uniqueProfiles(rows: CaptainPilotRedemptionRow[]) {
  return new Set(rows.map((row) => row.profile_id).filter(Boolean)).size
}
