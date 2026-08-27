import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildProductAccessState } from './access-model-core'
import { cacheServerAccountRole, readCachedServerAccountRole } from './server-account-role-cache'
import { normalizeSubscriptionStatus } from './subscription-status'
import { supabaseKey, supabaseUrl } from './supabase'

type CaptainApiAuth =
  | { ok: true; supabase: SupabaseClient; userId: string }
  | { ok: false; response: Response }

type ProfileEntitlementRow = {
  role?: string | null
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
  // Verify the signed token locally/JWKS-first instead of making every Captain
  // page wait on the Auth user endpoint. This is still a cryptographic token
  // verification; it simply avoids a fragile extra network round-trip before
  // the scoped server query begins.
  const { data, error } = await supabase.auth.getClaims(token)
  const userId = typeof data?.claims.sub === 'string' ? data.claims.sub : ''
  if (error || !userId) {
    return {
      ok: false,
      response: Response.json({ ok: false, message: 'Sign in to use Captain tools.' }, { status: 401 }),
    }
  }

  const cachedRole = await readCachedServerAccountRole(userId)
  const { data: profile } = cachedRole === 'admin'
    ? { data: { role: 'admin' } }
    : await supabase
      .from('profiles')
      .select(
        'role, player_plus_subscription_active, player_plus_subscription_status, coach_subscription_active, coach_subscription_status, captain_subscription_active, captain_subscription_status, tiq_team_league_entry_enabled, tiq_individual_league_creator_enabled'
      )
      .eq('id', userId)
      .maybeSingle()
  const row = (profile ?? {}) as ProfileEntitlementRow
  // Admin is a platform role, not a paid subscription. Preserve its built-in
  // Captain authority instead of downgrading it to a plain member during a
  // server-side Captain request.
  const access = buildProductAccessState(row.role === 'admin' ? 'admin' : 'member', {
    playerPlusSubscriptionActive: Boolean(row.player_plus_subscription_active),
    playerPlusSubscriptionStatus: normalizeSubscriptionStatus(row.player_plus_subscription_status),
    coachSubscriptionActive: Boolean(row.coach_subscription_active),
    coachSubscriptionStatus: normalizeSubscriptionStatus(row.coach_subscription_status),
    captainSubscriptionActive: Boolean(row.captain_subscription_active),
    captainSubscriptionStatus: normalizeSubscriptionStatus(row.captain_subscription_status),
    tiqTeamLeagueEntryEnabled: Boolean(row.tiq_team_league_entry_enabled),
    tiqIndividualLeagueCreatorEnabled: Boolean(row.tiq_individual_league_creator_enabled),
  })
  if (row.role === 'admin') void cacheServerAccountRole(userId, 'admin')

  if (!access.canUseCaptainWorkflow) {
    return {
      ok: false,
      response: Response.json({ ok: false, message: 'Captain access is required.' }, { status: 403 }),
    }
  }

  return { ok: true, supabase, userId }
}

function getBearerToken(request: Request) {
  const value = request.headers.get('authorization') ?? ''
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : ''
}
