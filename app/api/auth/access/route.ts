import { createClient } from '@supabase/supabase-js'
import type { ProductEntitlementSnapshot } from '@/lib/access-model-core'
import { normalizeUserRole, type UserRole } from '@/lib/roles'
import { cacheServerAccountRole } from '@/lib/server-account-role-cache'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { normalizeSubscriptionStatus } from '@/lib/subscription-status'

export const runtime = 'nodejs'

// Keep the first authenticated request independent from browser-facing product
// modules. This route is the boot path for every protected surface.
const DEFAULT_ENTITLEMENTS: ProductEntitlementSnapshot = {
  playerPlusSubscriptionActive: false,
  playerPlusSubscriptionStatus: 'inactive',
  playerPlusAccessExpiresAt: null,
  coachSubscriptionActive: false,
  coachSubscriptionStatus: 'inactive',
  coachAccessExpiresAt: null,
  captainSubscriptionActive: false,
  captainSubscriptionStatus: 'inactive',
  captainAccessExpiresAt: null,
  tiqTeamLeagueEntryEnabled: false,
  tiqIndividualLeagueCreatorEnabled: false,
  leagueAccessExpiresAt: null,
}

type ProfileAccessRow = {
  role?: unknown
  player_plus_subscription_active?: boolean | null
  player_plus_subscription_status?: string | null
  player_plus_access_expires_at?: string | null
  coach_subscription_active?: boolean | null
  coach_subscription_status?: string | null
  coach_access_expires_at?: string | null
  captain_subscription_active?: boolean | null
  captain_subscription_status?: string | null
  captain_access_expires_at?: string | null
  tiq_team_league_entry_enabled?: boolean | null
  tiq_individual_league_creator_enabled?: boolean | null
  league_access_expires_at?: string | null
}

const PROFILE_ACCESS_SELECT = [
  'role',
  'player_plus_subscription_active',
  'player_plus_subscription_status',
  'player_plus_access_expires_at',
  'coach_subscription_active',
  'coach_subscription_status',
  'coach_access_expires_at',
  'captain_subscription_active',
  'captain_subscription_status',
  'captain_access_expires_at',
  'tiq_team_league_entry_enabled',
  'tiq_individual_league_creator_enabled',
  'league_access_expires_at',
].join(',')

export async function GET(request: Request) {
  const startedAt = Date.now()
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in to load account access.' }, { status: 401 })
  }

  const requester = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  // JWT claims are cryptographically verified and avoid a second remote Auth
  // request on every page shell. Under database pressure that extra request
  // was the first long pole for Team and Admin navigation on mobile.
  const { data: claimData, error: claimError } = await requester.auth.getClaims(token)
  const userId = typeof claimData?.claims.sub === 'string' ? claimData.claims.sub : ''
  if (claimError || !userId) {
    return Response.json({ ok: false, message: 'Sign in to load account access.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    console.error('[api/auth/access] service access is not configured')
    return Response.json({ ok: false, message: 'Account access is temporarily unavailable.' }, { status: 503 })
  }

  const database = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const result = await database
    .from('profiles')
    .select(PROFILE_ACCESS_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (result.error) {
    console.error('[api/auth/access] profile lookup failed', {
      code: result.error.code,
      durationMs: Date.now() - startedAt,
    })
    return Response.json({ ok: false, message: 'Account access is temporarily unavailable.' }, { status: 503 })
  }

  const row = result.data as ProfileAccessRow | null
  const access = {
    role: normalizeUserRole(row?.role ?? 'member') as UserRole,
    entitlements: toEntitlements(row),
  }
  void cacheServerAccountRole(userId, access.role)

  console.info('[api/auth/access] loaded', {
    durationMs: Date.now() - startedAt,
    role: access.role,
    foundProfile: Boolean(row),
  })
  return Response.json({ ok: true, access }, { headers: { 'Cache-Control': 'no-store' } })
}

function toEntitlements(row: ProfileAccessRow | null): ProductEntitlementSnapshot {
  if (!row) return DEFAULT_ENTITLEMENTS

  return {
    playerPlusSubscriptionActive: Boolean(row.player_plus_subscription_active),
    playerPlusSubscriptionStatus: normalizeSubscriptionStatus(row.player_plus_subscription_status),
    playerPlusAccessExpiresAt: row.player_plus_access_expires_at ?? null,
    coachSubscriptionActive: Boolean(row.coach_subscription_active),
    coachSubscriptionStatus: normalizeSubscriptionStatus(row.coach_subscription_status),
    coachAccessExpiresAt: row.coach_access_expires_at ?? null,
    captainSubscriptionActive: Boolean(row.captain_subscription_active),
    captainSubscriptionStatus: normalizeSubscriptionStatus(row.captain_subscription_status),
    captainAccessExpiresAt: row.captain_access_expires_at ?? null,
    tiqTeamLeagueEntryEnabled: Boolean(row.tiq_team_league_entry_enabled),
    tiqIndividualLeagueCreatorEnabled: Boolean(row.tiq_individual_league_creator_enabled),
    leagueAccessExpiresAt: row.league_access_expires_at ?? null,
  }
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}
