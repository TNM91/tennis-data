import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildProductAccessState, normalizeSubscriptionStatus } from './access-model-core'
import { supabaseKey, supabaseUrl } from './supabase'

type CaptainApiAuth =
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; response: Response }

type ProfileEntitlementRow = {
  player_plus_subscription_active?: boolean | null
  player_plus_subscription_status?: string | null
  coach_subscription_active?: boolean | null
  coach_subscription_status?: string | null
  captain_subscription_active?: boolean | null
  captain_subscription_status?: string | null
  tiq_team_league_entry_enabled?: boolean | null
  tiq_individual_league_creator_enabled?: boolean | null
}

export async function getCaptainApiAuth(request: Request): Promise<CaptainApiAuth> {
  const token = getBearerToken(request)
  if (!token) {
    return {
      ok: false,
      response: Response.json({ ok: false, message: 'Sign in to use Captain tools.' }, { status: 401 }),
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    return {
      ok: false,
      response: Response.json({ ok: false, message: 'Sign in to use Captain tools.' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'player_plus_subscription_active, player_plus_subscription_status, coach_subscription_active, coach_subscription_status, captain_subscription_active, captain_subscription_status, tiq_team_league_entry_enabled, tiq_individual_league_creator_enabled'
    )
    .eq('id', data.user.id)
    .maybeSingle()
  const row = (profile ?? {}) as ProfileEntitlementRow
  const access = buildProductAccessState('member', {
    playerPlusSubscriptionActive: Boolean(row.player_plus_subscription_active),
    playerPlusSubscriptionStatus: normalizeSubscriptionStatus(row.player_plus_subscription_status),
    coachSubscriptionActive: Boolean(row.coach_subscription_active),
    coachSubscriptionStatus: normalizeSubscriptionStatus(row.coach_subscription_status),
    captainSubscriptionActive: Boolean(row.captain_subscription_active),
    captainSubscriptionStatus: normalizeSubscriptionStatus(row.captain_subscription_status),
    tiqTeamLeagueEntryEnabled: Boolean(row.tiq_team_league_entry_enabled),
    tiqIndividualLeagueCreatorEnabled: Boolean(row.tiq_individual_league_creator_enabled),
  })

  if (!access.canUseCaptainWorkflow) {
    return {
      ok: false,
      response: Response.json({ ok: false, message: 'Captain access is required.' }, { status: 403 }),
    }
  }

  return { ok: true, supabase, userId: data.user.id }
}

function getBearerToken(request: Request) {
  const value = request.headers.get('authorization') ?? ''
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : ''
}
