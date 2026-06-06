import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isMissingProfileLinkSchemaError } from '@/lib/profile-link-storage'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type ProfileLinkBody = {
  linkedPlayerId?: unknown
  playerName?: unknown
  selfRating?: unknown
}

type PlayerRow = {
  id: string
  name: string
  location?: string | null
  flight?: string | null
  overall_rating?: number | null
  singles_rating?: number | null
  doubles_rating?: number | null
  overall_dynamic_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_dynamic_rating?: number | null
  overall_usta_dynamic_rating?: number | null
  singles_usta_dynamic_rating?: number | null
  doubles_usta_dynamic_rating?: number | null
  rating_source?: string | null
}

const PLAYER_SELECT_WITH_SOURCE = `
  id,
  name,
  location,
  flight,
  overall_rating,
  singles_rating,
  doubles_rating,
  overall_dynamic_rating,
  singles_dynamic_rating,
  doubles_dynamic_rating,
  overall_usta_dynamic_rating,
  singles_usta_dynamic_rating,
  doubles_usta_dynamic_rating,
  rating_source
`

const PLAYER_SELECT_BASE = `
  id,
  name,
  location,
  flight,
  overall_rating,
  singles_rating,
  doubles_rating,
  overall_dynamic_rating,
  singles_dynamic_rating,
  doubles_dynamic_rating,
  overall_usta_dynamic_rating,
  singles_usta_dynamic_rating,
  doubles_usta_dynamic_rating
`

export async function GET(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in to load your player profile.' }, { status: 401 })
  }

  const requester = await getRequesterUser(token)
  if (!requester.userId) {
    return Response.json({ ok: false, message: 'Sign in to load your player profile.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return Response.json({ ok: false, message: 'Profile sync is missing Supabase service access.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  try {
    const profile = await loadProfileLink(supabase, requester.userId)
    return Response.json({
      ok: true,
      profile,
    })
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : 'Unable to load your player profile.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in to save your player profile.' }, { status: 401 })
  }

  let body: ProfileLinkBody
  try {
    body = (await request.json()) as ProfileLinkBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid profile request.' }, { status: 400 })
  }

  const requester = await getRequesterUser(token)
  if (!requester.userId) {
    return Response.json({ ok: false, message: 'Sign in to save your player profile.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return Response.json({ ok: false, message: 'Profile sync is missing Supabase service access.' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  try {
    const linkedPlayerId = cleanString(body.linkedPlayerId)
    const playerName = cleanPlayerName(body.playerName)
    const player = linkedPlayerId
      ? await loadPlayer(supabase, linkedPlayerId)
      : await createSelfRatedPlayer(supabase, playerName, normalizeSelfRating(body.selfRating))

    if (!player) {
      return Response.json(
        { ok: false, message: linkedPlayerId ? 'That player record could not be found.' : 'Type your tennis name to create a self-rated player.' },
        { status: 400 },
      )
    }

    const profilePayload = {
      id: requester.userId,
      linked_player_id: player.id,
      linked_player_name: player.name,
      linked_team_name: null,
      linked_league_name: null,
      linked_flight: player.flight ?? null,
      linked_team_at: new Date().toISOString(),
      message_display_name: player.name,
    }

    const profileRes = await saveProfileLink(supabase, profilePayload)

    return Response.json({
      ok: true,
      player,
      profile: profileRes,
    })
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : 'Unable to save your player profile.' },
      { status: 500 },
    )
  }
}

async function loadProfileLink(supabase: SupabaseClient, userId: string) {
  const fullRes = await supabase
    .from('profiles')
    .select('linked_player_id,linked_player_name,linked_team_name,linked_league_name,linked_flight,profile_photo_url,message_display_name')
    .eq('id', userId)
    .maybeSingle()

  if (!fullRes.error) return fullRes.data ?? null
  if (!isMissingProfileLinkSchemaError(fullRes.error.message)) throw new Error(fullRes.error.message)

  const compatibilityRes = await supabase
    .from('profiles')
    .select('linked_player_id,linked_player_name,linked_team_name,linked_league_name')
    .eq('id', userId)
    .maybeSingle()

  if (compatibilityRes.error) throw new Error(compatibilityRes.error.message)
  return compatibilityRes.data ?? null
}

async function saveProfileLink(supabase: SupabaseClient, profilePayload: {
  id: string
  linked_player_id: string
  linked_player_name: string
  linked_team_name: string | null
  linked_league_name: string | null
  linked_flight: string | null
  linked_team_at: string
  message_display_name: string
}) {
  const fullRes = await supabase
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })
    .select('linked_player_id,linked_player_name,linked_team_name,linked_league_name,linked_flight,profile_photo_url,message_display_name')
    .maybeSingle()

  if (!fullRes.error) return fullRes.data ?? profilePayload
  if (!isMissingProfileLinkSchemaError(fullRes.error.message)) throw new Error(fullRes.error.message)

  const compatibilityPayload = {
    id: profilePayload.id,
    linked_player_id: profilePayload.linked_player_id,
    linked_player_name: profilePayload.linked_player_name,
    linked_team_name: profilePayload.linked_team_name,
    linked_league_name: profilePayload.linked_league_name,
  }
  const compatibilityRes = await supabase
    .from('profiles')
    .upsert(compatibilityPayload, { onConflict: 'id' })
    .select('linked_player_id,linked_player_name,linked_team_name,linked_league_name')
    .maybeSingle()

  if (compatibilityRes.error) throw new Error(compatibilityRes.error.message)
  return compatibilityRes.data ?? compatibilityPayload
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

  if (error) return { userId: undefined, email: undefined }
  return { userId: data.user?.id, email: data.user?.email ?? undefined }
}

async function loadPlayer(supabase: SupabaseClient, playerId: string) {
  const withSource = await supabase
    .from('players')
    .select(PLAYER_SELECT_WITH_SOURCE)
    .eq('id', playerId)
    .maybeSingle()

  if (!withSource.error) return withSource.data as PlayerRow | null
  if (!isMissingRatingSourceError(withSource.error.message)) throw new Error(withSource.error.message)

  const base = await supabase
    .from('players')
    .select(PLAYER_SELECT_BASE)
    .eq('id', playerId)
    .maybeSingle()

  if (base.error) throw new Error(base.error.message)
  return base.data ? ({ ...(base.data as PlayerRow), rating_source: null }) : null
}

async function createSelfRatedPlayer(supabase: SupabaseClient, name: string, rating: number) {
  if (!name) return null

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
  if (!isMissingRatingSourceError(withSource.error.message)) throw new Error(withSource.error.message)

  const fallback = await supabase
    .from('players')
    .insert(basePayload)
    .select(PLAYER_SELECT_BASE)
    .maybeSingle()

  if (fallback.error) throw new Error(fallback.error.message)
  return fallback.data ? ({ ...(fallback.data as PlayerRow), rating_source: 'self' }) : null
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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
