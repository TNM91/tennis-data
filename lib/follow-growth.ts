import type { GrowthEvent } from './growth-cohort'

const FOLLOW_INTENT_WINDOW_MS = 60 * 60 * 1000

export type FollowAccessRequest = {
  requester_user_id: string | null
  plan_id: string | null
  next_href: string | null
  created_at: string
}

export function buildFollowGrowthCohort(events: GrowthEvent[], requests: FollowAccessRequest[]) {
  const clickedAt = new Map<string, number[]>()
  for (const event of events) {
    if (event.event_name !== 'follow_upgrade_clicked' || !event.user_id) continue
    const time = Date.parse(event.created_at)
    if (!Number.isFinite(time)) continue
    const times = clickedAt.get(event.user_id) ?? []
    times.push(time)
    clickedAt.set(event.user_id, times)
  }

  const requestUsers = new Set<string>()
  for (const request of requests) {
    if (!request.requester_user_id || request.plan_id !== 'player_plus' || !isFollowDestination(request.next_href)) continue
    const time = Date.parse(request.created_at)
    if (!Number.isFinite(time)) continue
    // A public request can be saved before its account is linked and the click is attributed at sign-in.
    const matchesIntent = clickedAt.get(request.requester_user_id)?.some((clickTime) => Math.abs(time - clickTime) <= FOLLOW_INTENT_WINDOW_MS)
    if (matchesIntent) requestUsers.add(request.requester_user_id)
  }

  const checkoutUsers = new Set<string>()
  const completedUsers = new Set<string>()
  for (const event of events) {
    if (!event.user_id) continue
    const time = Date.parse(event.created_at)
    if (!Number.isFinite(time)) continue
    const matchesIntent = clickedAt.get(event.user_id)?.some((clickTime) => time >= clickTime && time - clickTime <= FOLLOW_INTENT_WINDOW_MS)
    if (!matchesIntent) continue
    if (event.event_name === 'upgrade_checkout_started' && event.plan_id === 'player_plus') checkoutUsers.add(event.user_id)
    if (event.event_name === 'follow_intent_completed') completedUsers.add(event.user_id)
  }

  return {
    intentClicks: clickedAt.size,
    playerRequests: requestUsers.size,
    playerCheckoutStarts: checkoutUsers.size,
    completedFollows: completedUsers.size,
  }
}

function isFollowDestination(href: string | null) {
  return /^\/(players|teams|leagues)\/[^/?#]+(?:[?#]|$)/.test(href ?? '')
}
