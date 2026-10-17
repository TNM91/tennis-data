import { createClient } from '@supabase/supabase-js'
import { getPlayerApiAuth, getSignedInPlayerApiAuth } from '@/lib/player-api-auth'
import { supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type FollowInput = {
  entity_type: 'player' | 'team' | 'league'
  entity_id: string
  entity_name: string
  subtitle: string | null
}

function parseFollow(value: unknown): FollowInput | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (item.entity_type !== 'player' && item.entity_type !== 'team' && item.entity_type !== 'league') return null
  const entityId = typeof item.entity_id === 'string' ? item.entity_id.trim() : ''
  const entityName = typeof item.entity_name === 'string' ? item.entity_name.trim() : ''
  const subtitle = item.subtitle == null ? null : typeof item.subtitle === 'string' ? item.subtitle.trim() : null
  if (!entityId || entityId.length > 160 || !entityName || entityName.length > 200 || (subtitle?.length ?? 0) > 300) return null
  return { entity_type: item.entity_type, entity_id: entityId, entity_name: entityName, subtitle }
}

async function readFollow(request: Request) {
  try {
    return parseFollow(await request.json())
  } catch {
    return null
  }
}

function getDatabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return key
    ? createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    : null
}

function unavailable() {
  return Response.json({ ok: false, message: 'Follows are temporarily unavailable.' }, { status: 503 })
}

export async function POST(request: Request) {
  const auth = await getPlayerApiAuth(request)
  if (!auth.ok) return auth.response
  const item = await readFollow(request)
  if (!item) return Response.json({ ok: false, message: 'Choose a valid player, team, or league.' }, { status: 400 })
  const database = getDatabase()
  if (!database) return unavailable()

  const existing = await database.from('user_follows').select('id').eq('user_id', auth.userId)
    .eq('entity_type', item.entity_type).eq('entity_id', item.entity_id).limit(1)
  if (existing.error) return unavailable()
  if (existing.data?.length) return Response.json({ ok: true, following: true })

  const { error } = await database.from('user_follows').insert({ ...item, user_id: auth.userId })
  if (error) {
    console.error('[api/follows] insert failed', { code: error.code })
    return unavailable()
  }
  return Response.json({ ok: true, following: true }, { status: 201 })
}

export async function DELETE(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response
  const item = await readFollow(request)
  if (!item) return Response.json({ ok: false, message: 'Choose a valid player, team, or league.' }, { status: 400 })
  const database = getDatabase()
  if (!database) return unavailable()

  const { error } = await database.from('user_follows').delete().eq('user_id', auth.userId)
    .eq('entity_type', item.entity_type).eq('entity_id', item.entity_id)
  if (error) {
    console.error('[api/follows] delete failed', { code: error.code })
    return unavailable()
  }
  return Response.json({ ok: true, following: false })
}
