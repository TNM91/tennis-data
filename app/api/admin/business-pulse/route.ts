import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminApiAuth } from '@/lib/admin-api-auth'
import {
  buildBusinessPulse,
  type BusinessPulseClubRow,
  type BusinessPulseEventRow,
  type BusinessPulseProfileRow,
} from '@/lib/admin-business-pulse'

export const runtime = 'nodejs'

const PAGE_SIZE = 1000
const PROFILE_COLUMNS = 'id,role,stripe_customer_id,stripe_subscription_id,player_plus_subscription_active,player_plus_subscription_status,player_plus_access_expires_at,coach_subscription_active,coach_subscription_status,coach_access_expires_at,captain_subscription_active,captain_subscription_status,captain_access_expires_at,tiq_team_league_entry_enabled,tiq_individual_league_creator_enabled,league_access_expires_at'

export async function GET(request: Request) {
  const auth = await getAdminApiAuth(request)
  if (!auth.ok) return auth.response

  const [profilesResult, clubsResult, eventsResult] = await Promise.all([
    loadProfiles(auth.service),
    loadClubs(auth.service),
    loadBillingEvents(auth.service),
  ])

  if (!profilesResult.ok) {
    return Response.json({ ok: false, message: 'Subscription accounts could not be loaded.' }, { status: 500 })
  }
  if (!clubsResult.ok) {
    return Response.json({ ok: false, message: 'Club subscriptions could not be loaded.' }, { status: 500 })
  }
  if (!eventsResult.ok) {
    return Response.json({ ok: false, message: 'Recent billing activity could not be loaded.' }, { status: 500 })
  }

  const pulse = buildBusinessPulse({
    profiles: profilesResult.rows,
    clubs: clubsResult.rows,
    events: eventsResult.rows,
  })

  return Response.json({ ok: true, pulse }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

async function loadProfiles(service: SupabaseClient) {
  const rows: BusinessPulseProfileRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await service
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) return { ok: false as const, rows: [] }
    rows.push(...((data ?? []) as BusinessPulseProfileRow[]))
    if ((data?.length ?? 0) < PAGE_SIZE) break
  }
  return { ok: true as const, rows }
}

async function loadClubs(service: SupabaseClient) {
  const rows: BusinessPulseClubRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await service
      .from('club_billing_accounts')
      .select('owner_user_id,plan_id,status,stripe_subscription_id')
      .order('owner_user_id')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) return { ok: false as const, rows: [] }
    rows.push(...((data ?? []) as BusinessPulseClubRow[]))
    if ((data?.length ?? 0) < PAGE_SIZE) break
  }
  return { ok: true as const, rows }
}

async function loadBillingEvents(service: SupabaseClient) {
  const rows: BusinessPulseEventRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await service
      .from('stripe_billing_events')
      .select('stripe_event_id,event_type,outcome,profile_id,stripe_subscription_id,plan_id,resulting_status,created_at')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) return { ok: false as const, rows: [] }
    rows.push(...((data ?? []) as BusinessPulseEventRow[]))
    if ((data?.length ?? 0) < PAGE_SIZE) break
  }
  return { ok: true as const, rows }
}
