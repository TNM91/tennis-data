import { getAdminApiAuth } from '@/lib/admin-api-auth'
import { enqueueTennisRecordUrls, getTennisRecordOperationalStatus, runTennisRecordSync } from '@/lib/tennisrecord/service'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const auth = await getAdminApiAuth(request)
  if (!auth.ok) return auth.response
  try { return Response.json({ ok: true, ...(await getTennisRecordOperationalStatus(auth.service)) }) }
  catch { return Response.json({ ok: false, message: 'TennisRecord operations are temporarily unavailable.' }, { status: 500 }) }
}

export async function POST(request: Request) {
  const auth = await getAdminApiAuth(request)
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null) as { action?: unknown; urls?: unknown; enabled?: unknown; stagedPlayerId?: unknown; canonicalPlayerId?: unknown } | null
  const action = typeof body?.action === 'string' ? body.action : ''
  try {
    if (action === 'set_enabled') {
      if (typeof body?.enabled !== 'boolean') return Response.json({ ok: false, message: 'Choose whether the collector is enabled.' }, { status: 400 })
      const { error } = await auth.service.from('tennisrecord_collector_settings').update({ enabled: body.enabled, updated_by_user_id: auth.userId }).eq('id', true)
      if (error) throw error
      return Response.json({ ok: true, enabled: body.enabled })
    }
    if (action === 'enqueue') {
      const urls = Array.isArray(body?.urls) ? body.urls.filter((url): url is string => typeof url === 'string') : []
      const queued = await enqueueTennisRecordUrls(auth.service, urls)
      return Response.json({ ok: true, queued })
    }
    if (action === 'resolve_identity') {
      const stagedPlayerId = typeof body?.stagedPlayerId === 'string' ? body.stagedPlayerId.trim() : ''
      const canonicalPlayerId = typeof body?.canonicalPlayerId === 'string' ? body.canonicalPlayerId.trim() : ''
      if (!stagedPlayerId || !canonicalPlayerId) return Response.json({ ok: false, message: 'Choose both the staged player and a TenAceIQ player.' }, { status: 400 })
      const player = await auth.service.from('players').select('id').eq('id', canonicalPlayerId).maybeSingle()
      if (player.error || !player.data) return Response.json({ ok: false, message: 'That TenAceIQ player was not found.' }, { status: 404 })
      const { error } = await auth.service.from('tennisrecord_player_identities').update({ canonical_player_id: canonicalPlayerId, status: 'matched', confidence: 1, signals: ['admin_verified_mapping'], reviewed_at: new Date().toISOString(), reviewed_by_user_id: auth.userId }).eq('staged_player_id', stagedPlayerId)
      if (error) throw error
      return Response.json({ ok: true })
    }
    if (action === 'run') return Response.json({ ok: true, summary: await runTennisRecordSync(auth.service, { triggerKind: 'manual', requestedByUserId: auth.userId, limit: 5 }) })
    return Response.json({ ok: false, message: 'Unknown TennisRecord operation.' }, { status: 400 })
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : 'TennisRecord operation failed.' }, { status: 500 })
  }
}
