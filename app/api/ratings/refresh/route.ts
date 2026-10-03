import { createServerSupabaseClient } from '@/lib/ingestion/autoImport'
import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) return auth.response
  try {
    const service = createServerSupabaseClient()
    const { data, error: readError } = await service.from('tennisrecord_collector_settings').select('rating_recalculation_requested_at').eq('id', true).single()
    if (readError) throw readError
    // Coalesce activity requests globally; only the protected cadence can run a rebuild.
    if (!data.rating_recalculation_requested_at || Date.now() - Date.parse(data.rating_recalculation_requested_at) >= 60_000) {
      const { error } = await service.from('tennisrecord_collector_settings').update({ rating_recalculation_requested_at: new Date().toISOString(), rating_recalculation_reason: 'Reviewed match activity requested a TIQ refresh' }).eq('id', true)
      if (error) throw error
    }
    return Response.json({ ok: true, queued: true, message: 'TIQ refresh queued. Ratings update after the next scheduled calculation.' }, { status: 202 })
  } catch (error) {
    console.error('Rating refresh request failed', error)
    return Response.json({ ok: false, message: 'Unable to queue a rating refresh. Try again shortly.' }, { status: 503 })
  }
}
