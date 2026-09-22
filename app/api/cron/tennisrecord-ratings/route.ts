import { createServerSupabaseClient } from '@/lib/ingestion/autoImport'
import { runScheduledTennisRecordRatingBatch } from '@/lib/tennisrecord/service'

export const runtime = 'nodejs'
// This uses the existing full TiQ engine once per controlled cadence.
export const maxDuration = 300

export async function GET(request: Request) {
  const startedAt = Date.now()
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, message: 'Scheduled rating batch is not authorized.' }, { status: 401 })
  }

  const collectorFlag = process.env.TENNISRECORD_COLLECTOR_ENABLED?.trim().toLowerCase()
  if (collectorFlag === 'false' || collectorFlag === '0' || collectorFlag === 'off') {
    return Response.json({ ok: true, summary: { status: 'disabled' }, message: 'Scheduled rating batch is paused by the collector circuit breaker.' })
  }

  try {
    const service = createServerSupabaseClient()
    const summary = await runScheduledTennisRecordRatingBatch(service)
    console.info(JSON.stringify({
      level: 'info',
      event: 'tennisrecord_rating_batch',
      requestId: request.headers.get('x-vercel-id'),
      summary,
      duration_ms: Date.now() - startedAt,
    }))
    return Response.json({ ok: true, summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scheduled rating batch failed.'
    console.error(JSON.stringify({
      level: 'error',
      event: 'tennisrecord_rating_batch_failed',
      requestId: request.headers.get('x-vercel-id'),
      message,
      duration_ms: Date.now() - startedAt,
    }))
    return Response.json({ ok: false, message }, { status: 500 })
  }
}
