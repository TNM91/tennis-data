import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildProductAccessState, normalizeSubscriptionStatus } from '@/lib/access-model-core'
import { normalizeUserRole } from '@/lib/roles'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type EntrantProfilesBody = {
  tournamentId?: unknown
  entrants?: unknown
  selfRating?: unknown
}

type PlayerRow = {
  id: string
  name: string
  rating_source?: string | null
}

type ProfileEntitlementRow = {
  role?: string | null
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

const PLAYER_SELECT_WITH_SOURCE = 'id,name,rating_source'
const PLAYER_SELECT_BASE = 'id,name'

export async function POST(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in to create tournament player profiles.' }, { status: 401 })
  }

  const requester = await getRequesterUser(token)
  if (!requester.ok) return requester.response

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return Response.json({ ok: false, message: 'Tournament profile sync is missing Supabase service access.' }, { status: 500 })
  }

  let body: EntrantProfilesBody
  try {
    body = (await request.json()) as EntrantProfilesBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid tournament profile request.' }, { status: 400 })
  }

  const entrants = normalizeEntrants(body.entrants)
  const tournamentId = cleanPlayerName(body.tournamentId)
  if (!tournamentId) {
    return Response.json({ ok: false, message: 'Choose a tournament before creating player profiles.' }, { status: 400 })
  }
  if (!entrants.length) {
    return Response.json({ ok: false, message: 'Add tournament entrants before creating player profiles.' }, { status: 400 })
  }
  if (entrants.length > 64) {
    return Response.json({ ok: false, message: 'Create no more than 64 player profiles at a time.' }, { status: 413 })
  }

  const ownership = await requester.supabase
    .from('tiq_tournaments')
    .select('id,created_by_user_id')
    .eq('id', tournamentId)
    .maybeSingle()
  if (ownership.error) {
    console.error('Tournament profile ownership lookup failed', ownership.error)
    return Response.json({ ok: false, message: 'Tournament ownership could not be verified.' }, { status: 503 })
  }
  if (ownership.data?.created_by_user_id !== requester.userId) {
    return Response.json({ ok: false, message: 'You can only create profiles for a tournament you created.' }, { status: 403 })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  try {
    const selfRating = normalizeSelfRating(body.selfRating)
    const players = await Promise.all(entrants.map((entrant) => findOrCreateSelfRatedPlayer(supabase, entrant, selfRating)))
    const entrantPlayerIds = Object.fromEntries(players.filter(Boolean).map((player) => [player!.name, player!.id]))

    return Response.json({
      ok: true,
      entrantPlayerIds,
      players,
    })
  } catch (error) {
    console.error('Tournament entrant profile sync failed', error)
    return Response.json(
      { ok: false, message: 'Unable to create tournament player profiles.' },
      { status: 500 },
    )
  }
}

async function getRequesterUser(token: string) {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
  const { data, error } = await supabase.auth.getUser(token)

  const userId = data.user?.id
  if (error || !userId) {
    return {
      ok: false as const,
      response: Response.json({ ok: false, message: 'Sign in to create tournament player profiles.' }, { status: 401 }),
    }
  }

  const profileResult = await supabase
    .from('profiles')
    .select('role,player_plus_subscription_active,player_plus_subscription_status,player_plus_access_expires_at,coach_subscription_active,coach_subscription_status,coach_access_expires_at,captain_subscription_active,captain_subscription_status,captain_access_expires_at,tiq_team_league_entry_enabled,tiq_individual_league_creator_enabled,league_access_expires_at')
    .eq('id', userId)
    .maybeSingle()
  if (profileResult.error) {
    console.error('Tournament profile entitlement lookup failed', profileResult.error)
    return {
      ok: false as const,
      response: Response.json({ ok: false, message: 'Tournament access could not be verified.' }, { status: 503 }),
    }
  }

  const profile = (profileResult.data || {}) as ProfileEntitlementRow
  const access = buildProductAccessState(normalizeUserRole(profile.role), {
    playerPlusSubscriptionActive: Boolean(profile.player_plus_subscription_active),
    playerPlusSubscriptionStatus: normalizeSubscriptionStatus(profile.player_plus_subscription_status),
    playerPlusAccessExpiresAt: profile.player_plus_access_expires_at || null,
    coachSubscriptionActive: Boolean(profile.coach_subscription_active),
    coachSubscriptionStatus: normalizeSubscriptionStatus(profile.coach_subscription_status),
    coachAccessExpiresAt: profile.coach_access_expires_at || null,
    captainSubscriptionActive: Boolean(profile.captain_subscription_active),
    captainSubscriptionStatus: normalizeSubscriptionStatus(profile.captain_subscription_status),
    captainAccessExpiresAt: profile.captain_access_expires_at || null,
    tiqTeamLeagueEntryEnabled: Boolean(profile.tiq_team_league_entry_enabled),
    tiqIndividualLeagueCreatorEnabled: Boolean(profile.tiq_individual_league_creator_enabled),
    leagueAccessExpiresAt: profile.league_access_expires_at || null,
  })
  if (!access.canUseLeagueTools) {
    return {
      ok: false as const,
      response: Response.json({ ok: false, message: 'League access is required to create tournament player profiles.' }, { status: 403 }),
    }
  }

  return { ok: true as const, userId, supabase }
}

async function findOrCreateSelfRatedPlayer(supabase: SupabaseClient, name: string, rating: number) {
  const existing = await loadExistingPlayer(supabase, name)
  if (existing) return existing

  const basePayload = {
    name,
    singles_rating: rating,
    singles_dynamic_rating: rating,
    doubles_rating: rating,
    doubles_dynamic_rating: rating,
    overall_rating: rating,
    overall_dynamic_rating: rating,
  }

  const withSource = await supabase
    .from('players')
    .insert({ ...basePayload, rating_source: 'self' })
    .select(PLAYER_SELECT_WITH_SOURCE)
    .maybeSingle()

  if (!withSource.error) return withSource.data as PlayerRow
  if (!isMissingRatingSourceError(withSource.error.message) && !isDuplicateError(withSource.error)) {
    throw new Error(withSource.error.message)
  }

  if (isDuplicateError(withSource.error)) {
    const duplicate = await loadExistingPlayer(supabase, name)
    if (duplicate) return duplicate
  }

  const fallback = await supabase
    .from('players')
    .insert(basePayload)
    .select(PLAYER_SELECT_BASE)
    .maybeSingle()

  if (!fallback.error) return { ...(fallback.data as PlayerRow), rating_source: 'self' }
  if (isDuplicateError(fallback.error)) {
    const duplicate = await loadExistingPlayer(supabase, name)
    if (duplicate) return duplicate
  }

  throw new Error(fallback.error.message)
}

async function loadExistingPlayer(supabase: SupabaseClient, name: string) {
  const withSource = await supabase
    .from('players')
    .select(PLAYER_SELECT_WITH_SOURCE)
    .ilike('name', name)
    .limit(1)
    .maybeSingle()

  if (!withSource.error) return withSource.data as PlayerRow | null
  if (!isMissingRatingSourceError(withSource.error.message)) throw new Error(withSource.error.message)

  const base = await supabase
    .from('players')
    .select(PLAYER_SELECT_BASE)
    .ilike('name', name)
    .limit(1)
    .maybeSingle()

  if (base.error) throw new Error(base.error.message)
  return base.data ? ({ ...(base.data as PlayerRow), rating_source: null }) : null
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function normalizeEntrants(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((item) => cleanPlayerName(item)).filter(Boolean)))
}

function cleanPlayerName(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
}

function normalizeSelfRating(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(typeof value === 'string' ? value : '')
  if (!Number.isFinite(parsed)) return 3.5
  return Math.min(7, Math.max(1, Math.round(parsed * 10) / 10))
}

function isMissingRatingSourceError(message: string | null | undefined) {
  const normalized = (message || '').toLowerCase()
  return normalized.includes('rating_source') || normalized.includes('schema cache') || normalized.includes('column')
}

function isDuplicateError(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === '23505' || (error?.message || '').toLowerCase().includes('duplicate')
}
