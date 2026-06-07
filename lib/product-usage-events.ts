import type { PricingPlanId } from './pricing-plans'

export const PRODUCT_USAGE_EVENT_NAMES = [
  'billing_portal_opened',
  'upgrade_checkout_started',
  'profile_player_linked',
  'profile_cloud_sync_repair',
  'mylab_match_plan_action',
  'mylab_goal_template_applied',
  'captain_closeout_action',
  'captain_team_scope_selected',
  'search_submitted',
  'search_result_clicked',
  'search_category_selected',
  'zero_result_seen',
  'matchup_started',
  'player_a_selected',
  'player_b_selected',
  'matchup_preview_viewed',
  'matchup_unlock_clicked',
  'coach_page_viewed',
  'find_coach_clicked',
  'coach_hub_clicked',
  'coach_assignment_preview_clicked',
  'team_search_submitted',
  'captain_tools_clicked',
  'lineup_preview_clicked',
  'availability_clicked',
  'tournament_search_submitted',
  'run_tournament_clicked',
  'tournament_desk_clicked',
  'draw_preview_clicked',
  'league_search_submitted',
  'league_office_clicked',
  'schedule_preview_clicked',
  'standings_preview_clicked',
  'data_assist_opened',
  'upload_type_selected',
  'scorecard_upload_started',
  'schedule_upload_started',
  'team_summary_upload_started',
  'data_issue_reported',
] as const

export const PRODUCT_USAGE_EVENT_SURFACES = [
  'profile',
  'mylab',
  'captain',
  'billing',
  'upgrade',
  'public_site',
  'search',
  'matchup',
  'coach',
  'teams',
  'tournaments',
  'leagues',
  'data_assist',
] as const

export type ProductUsageEventName = (typeof PRODUCT_USAGE_EVENT_NAMES)[number]
export type ProductUsageEventSurface = (typeof PRODUCT_USAGE_EVENT_SURFACES)[number]

export type ProductUsageEventInput = {
  eventName: ProductUsageEventName
  surface: ProductUsageEventSurface
  planId?: Extract<PricingPlanId, 'player_plus' | 'coach' | 'captain' | 'league' | 'full_court'> | null
  metadata?: Record<string, unknown>
}

type RawProductUsageEventInput = {
  eventName?: string | null
  surface?: string | null
  planId?: string | null
  metadata?: Record<string, unknown>
}

export type ProductUsageEventInsert = {
  user_id: string
  event_name: ProductUsageEventName
  surface: ProductUsageEventSurface
  plan_id: string | null
  metadata: Record<string, unknown>
}

export function normalizeProductUsageEventInput(input: RawProductUsageEventInput) {
  const eventName = PRODUCT_USAGE_EVENT_NAMES.includes(input.eventName as ProductUsageEventName)
    ? input.eventName as ProductUsageEventName
    : null
  const surface = PRODUCT_USAGE_EVENT_SURFACES.includes(input.surface as ProductUsageEventSurface)
    ? input.surface as ProductUsageEventSurface
    : null
  const planId = input.planId === 'player_plus' || input.planId === 'coach' || input.planId === 'captain' || input.planId === 'league' || input.planId === 'full_court'
    ? input.planId
    : null
  const metadata = sanitizeUsageMetadata(input.metadata)

  if (!eventName || !surface) return null

  return {
    eventName,
    surface,
    planId,
    metadata,
  }
}

export function buildProductUsageEventInsert(
  userId: string,
  input: RawProductUsageEventInput,
): ProductUsageEventInsert | null {
  const normalized = normalizeProductUsageEventInput(input)
  const cleanedUserId = userId.trim()
  if (!cleanedUserId || !normalized) return null

  return {
    user_id: cleanedUserId,
    event_name: normalized.eventName,
    surface: normalized.surface,
    plan_id: normalized.planId,
    metadata: normalized.metadata,
  }
}

function sanitizeUsageMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key.length <= 48)
      .slice(0, 20)
      .map(([key, item]) => [key, sanitizeUsageMetadataValue(item)]),
  )
}

function sanitizeUsageMetadataValue(value: unknown): unknown {
  if (value == null) return null
  if (typeof value === 'string') return value.slice(0, 240)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 10).map(sanitizeUsageMetadataValue)
  if (typeof value === 'object') {
    return sanitizeUsageMetadata(value)
  }
  return String(value).slice(0, 240)
}
