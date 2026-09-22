import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getPlayerApiAuth } from '@/lib/player-api-auth'
import { supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

const ALLOWED_FEATURE_KEYS = new Set([
  'verified-honors',
  'match-streak',
  'reviewed-competitor',
  'first-evidence',
])

type ShowcaseRequest = { playerId?: unknown; featuredKeys?: unknown }
type PlayerMatchRow = {
  side?: string | null
  matches?: { winner_side?: string | null; match_date?: string | null } | null
}

export async function POST(request: Request) {
  const auth = await getPlayerApiAuth(request)
  if (!auth.ok) return auth.response

  let body: ShowcaseRequest
  try {
    body = (await request.json()) as ShowcaseRequest
  } catch {
    return Response.json({ ok: false, message: 'Your achievement selection is invalid.' }, { status: 400 })
  }

  const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : ''
  const featuredKeys = normalizeFeaturedKeys(body.featuredKeys)
  if (!playerId) return Response.json({ ok: false, message: 'Choose your linked player first.' }, { status: 400 })

  const { data: profile, error: profileError } = await auth.supabase
    .from('profiles')
    .select('linked_player_id')
    .eq('id', auth.userId)
    .maybeSingle()
  if (profileError) return Response.json({ ok: false, message: 'Unable to verify your player profile.' }, { status: 503 })
  if ((profile as { linked_player_id?: string | null } | null)?.linked_player_id !== playerId) {
    return Response.json({ ok: false, message: 'You can only feature achievements earned by your linked player.' }, { status: 403 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return Response.json({ ok: false, message: 'Achievement saving is not configured yet.' }, { status: 503 })
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })

  const eligible = await loadEligibleAchievementKeys(service, playerId)
  const verifiedKeys = featuredKeys.filter((key) => eligible.has(key))
  if (verifiedKeys.length !== featuredKeys.length) {
    return Response.json({ ok: false, message: 'Choose only achievements that this player has earned.' }, { status: 400 })
  }

  const { data, error } = await service
    .from('player_achievement_showcases')
    .upsert({ player_id: playerId, profile_user_id: auth.userId, featured_keys: verifiedKeys, updated_at: new Date().toISOString() }, { onConflict: 'player_id' })
    .select('featured_keys,updated_at')
    .maybeSingle()
  if (error) {
    if (isMissingShowcaseSchema(error.message)) return Response.json({ ok: true, featuredKeys: verifiedKeys, cloudAvailable: false })
    return Response.json({ ok: false, message: 'Your achievement showcase could not be saved.' }, { status: 500 })
  }

  return Response.json({ ok: true, featuredKeys: normalizeFeaturedKeys((data as { featured_keys?: unknown } | null)?.featured_keys), cloudAvailable: true })
}

function normalizeFeaturedKeys(value: unknown) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((key): key is string => typeof key === 'string' && ALLOWED_FEATURE_KEYS.has(key)))].slice(0, 3)
}

async function loadEligibleAchievementKeys(service: SupabaseClient, playerId: string) {
  const [{ count: awardCount }, { count: matchCount }, matchResult] = await Promise.all([
    service.from('tiq_awards').select('*', { count: 'exact', head: true }).eq('recipient_player_id', playerId),
    service.from('match_players').select('*', { count: 'exact', head: true }).eq('player_id', playerId),
    service.from('match_players').select('side,matches!inner(winner_side,match_date)').eq('player_id', playerId),
  ])

  const eligible = new Set<string>()
  if ((awardCount || 0) > 0) eligible.add('verified-honors')
  if ((matchCount || 0) >= 10) eligible.add('reviewed-competitor')
  if ((matchCount || 0) > 0) eligible.add('first-evidence')

  const rows = ((matchResult.data || []) as PlayerMatchRow[])
    .filter((row) => row.matches?.match_date && row.matches?.winner_side && row.side)
    .sort((a, b) => String(b.matches?.match_date).localeCompare(String(a.matches?.match_date)))
  let longest = 0
  let current = 0
  for (const row of rows) {
    if (row.side === row.matches?.winner_side) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
  }
  if (longest >= 3) eligible.add('match-streak')
  return eligible
}

function isMissingShowcaseSchema(message: string | null | undefined) {
  const normalized = (message || '').toLowerCase()
  return normalized.includes('player_achievement_showcases') && (normalized.includes('does not exist') || normalized.includes('schema cache'))
}
