import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type EntrantProfilesBody = {
  entrants?: unknown
  selfRating?: unknown
}

type PlayerRow = {
  id: string
  name: string
  rating_source?: string | null
}

const PLAYER_SELECT_WITH_SOURCE = 'id,name,rating_source'
const PLAYER_SELECT_BASE = 'id,name'

export async function POST(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in to create tournament player profiles.' }, { status: 401 })
  }

  const requester = await getRequesterUser(token)
  if (!requester.userId) {
    return Response.json({ ok: false, message: 'Sign in to create tournament player profiles.' }, { status: 401 })
  }

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
  if (!entrants.length) {
    return Response.json({ ok: false, message: 'Add tournament entrants before creating player profiles.' }, { status: 400 })
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
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : 'Unable to create tournament player profiles.' },
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

  if (error) return { userId: undefined }
  return { userId: data.user?.id }
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
