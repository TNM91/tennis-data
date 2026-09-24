export type GrowthEvent = {
  user_id: string | null
  event_name: string | null
  plan_id?: string | null
  created_at: string
}

export type StripeBillingEvent = {
  profile_id: string | null
  outcome: string | null
  resulting_status: string | null
  created_at: string
}

const FIRST_VALUE_EVENTS = new Set([
  'search_result_clicked',
  'profile_player_linked',
  'team_connection_accepted',
  'connected_teams_opened',
  'team_chat_opened',
  'team_chat_message_sent',
  'mylab_goal_template_applied',
  'matchup_prep_saved',
  'lineup_preview_clicked',
  'coach_assignment_preview_clicked',
  'schedule_preview_clicked',
  'standings_preview_clicked',
  'follow_intent_completed',
])

export function buildGrowthCohort(events: GrowthEvent[], billingEvents: StripeBillingEvent[]) {
  const signupAt = new Map<string, number>()
  const firstActionAt = new Map<string, number>()
  const checkoutAt = new Map<string, number>()
  const publicActions = new Set<string>()

  for (const event of events) {
    if (!event.user_id) continue
    const occurredAt = Date.parse(event.created_at)
    if (!Number.isFinite(occurredAt)) continue
    if (event.event_name === 'signup_confirmation_sent') {
      signupAt.set(event.user_id, Math.min(signupAt.get(event.user_id) ?? Infinity, occurredAt))
    } else if (event.event_name) {
      publicActions.add(event.user_id)
    }
  }

  for (const event of events) {
    if (!event.user_id) continue
    const joinedAt = signupAt.get(event.user_id)
    const occurredAt = Date.parse(event.created_at)
    if (joinedAt === undefined || !Number.isFinite(occurredAt) || occurredAt < joinedAt) continue
    if (event.event_name && FIRST_VALUE_EVENTS.has(event.event_name)) {
      firstActionAt.set(event.user_id, Math.min(firstActionAt.get(event.user_id) ?? Infinity, occurredAt))
    }
    if (event.event_name === 'upgrade_checkout_started') {
      checkoutAt.set(event.user_id, Math.min(checkoutAt.get(event.user_id) ?? Infinity, occurredAt))
    }
  }

  const paidActivations = new Set<string>()
  for (const event of billingEvents) {
    if (!event.profile_id || event.outcome !== 'handled') continue
    if (event.resulting_status !== 'active' && event.resulting_status !== 'trial') continue
    const checkoutStartedAt = checkoutAt.get(event.profile_id)
    const occurredAt = Date.parse(event.created_at)
    if (checkoutStartedAt !== undefined && Number.isFinite(occurredAt) && occurredAt >= checkoutStartedAt) {
      paidActivations.add(event.profile_id)
    }
  }

  return {
    publicActions: publicActions.size,
    signupRequests: signupAt.size,
    firstActions: firstActionAt.size,
    checkoutStarts: checkoutAt.size,
    paidActivations: paidActivations.size,
  }
}
