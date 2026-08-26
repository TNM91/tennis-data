import { getAdminApiAuth } from '@/lib/admin-api-auth'
import { enqueueTennisRecordUrls, getTennisRecordOperationalStatus, runTennisRecordSync, seedTennisRecordCampaignFrontier } from '@/lib/tennisrecord/service'

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
  const body = await request.json().catch(() => null) as { action?: unknown; urls?: unknown; enabled?: unknown; automationState?: unknown; stagedPlayerId?: unknown; canonicalPlayerId?: unknown; campaignId?: unknown } | null
  const action = typeof body?.action === 'string' ? body.action : ''
  try {
    if (action === 'set_enabled') {
      if (typeof body?.enabled !== 'boolean') return Response.json({ ok: false, message: 'Choose whether the collector is enabled.' }, { status: 400 })
      const { error } = await auth.service.from('tennisrecord_collector_settings').update({ enabled: body.enabled, updated_by_user_id: auth.userId }).eq('id', true)
      if (error) throw error
      return Response.json({ ok: true, enabled: body.enabled })
    }
    if (action === 'set_automation_state') {
      const automationState = body?.automationState
      if (automationState !== 'manual' && automationState !== 'bootstrap' && automationState !== 'weekly') return Response.json({ ok: false, message: 'Choose a valid collector automation state.' }, { status: 400 })
      const now = new Date().toISOString()
      const updates = automationState === 'bootstrap'
        ? { automation_state: automationState, bootstrap_started_at: now, bootstrap_completed_at: null, updated_by_user_id: auth.userId }
        : { automation_state: automationState, updated_by_user_id: auth.userId }
      const { error } = await auth.service.from('tennisrecord_collector_settings').update(updates).eq('id', true)
      if (error) throw error
      return Response.json({ ok: true, automationState })
    }
    if (action === 'enqueue') {
      const urls = Array.isArray(body?.urls) ? body.urls.filter((url): url is string => typeof url === 'string') : []
      const settings = await auth.service.from('tennisrecord_collector_settings').select('active_campaign_id').eq('id', true).single()
      if (settings.error) throw settings.error
      const queued = await enqueueTennisRecordUrls(auth.service, urls, settings.data.active_campaign_id)
      return Response.json({ ok: true, queued })
    }
    if (action === 'seed_frontier') {
      const settings = await auth.service.from('tennisrecord_collector_settings').select('active_campaign_id').eq('id', true).single()
      if (settings.error) throw settings.error
      if (!settings.data.active_campaign_id) return Response.json({ ok: false, message: 'Choose a historical campaign before seeding its public frontier.' }, { status: 400 })
      const queued = await seedTennisRecordCampaignFrontier(auth.service, settings.data.active_campaign_id)
      return Response.json({ ok: true, queued })
    }
    if (action === 'set_active_campaign') {
      const campaignId = typeof body?.campaignId === 'string' ? body.campaignId.trim() : ''
      if (!campaignId) return Response.json({ ok: false, message: 'Choose a historical campaign.' }, { status: 400 })
      const campaign = await auth.service.from('tennisrecord_campaigns').select('id,status').eq('id', campaignId).maybeSingle()
      if (campaign.error) throw campaign.error
      if (!campaign.data || campaign.data.status === 'completed') return Response.json({ ok: false, message: 'That campaign is not available for collection.' }, { status: 400 })
      const { error } = await auth.service.from('tennisrecord_collector_settings').update({ active_campaign_id: campaignId, updated_by_user_id: auth.userId }).eq('id', true)
      if (error) throw error
      return Response.json({ ok: true, campaignId })
    }
    if (action === 'resolve_identity') {
      const stagedPlayerId = typeof body?.stagedPlayerId === 'string' ? body.stagedPlayerId.trim() : ''
      const canonicalPlayerId = typeof body?.canonicalPlayerId === 'string' ? body.canonicalPlayerId.trim() : ''
      if (!stagedPlayerId || !canonicalPlayerId) return Response.json({ ok: false, message: 'Choose both the staged player and a TenAceIQ player.' }, { status: 400 })
      const player = await auth.service.from('players').select('id').eq('id', canonicalPlayerId).maybeSingle()
      if (player.error || !player.data) return Response.json({ ok: false, message: 'That TenAceIQ player was not found.' }, { status: 404 })
      const { error } = await auth.service.from('tennisrecord_player_identities').update({ canonical_player_id: canonicalPlayerId, status: 'matched', confidence: 1, signals: ['admin_verified_mapping'], reviewed_at: new Date().toISOString(), reviewed_by_user_id: auth.userId }).eq('staged_player_id', stagedPlayerId)
      if (error) throw error
      const { error: observationError } = await auth.service
        .from('tennisrecord_ntrp_observations')
        .update({ canonical_player_id: canonicalPlayerId, last_seen_at: new Date().toISOString() })
        .eq('staged_player_id', stagedPlayerId)
      if (observationError) throw observationError
      return Response.json({ ok: true })
    }
    if (action === 'run') return Response.json({ ok: true, summary: await runTennisRecordSync(auth.service, { triggerKind: 'manual', requestedByUserId: auth.userId, limit: 5 }) })
    return Response.json({ ok: false, message: 'Unknown TennisRecord operation.' }, { status: 400 })
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : 'TennisRecord operation failed.' }, { status: 500 })
  }
}
