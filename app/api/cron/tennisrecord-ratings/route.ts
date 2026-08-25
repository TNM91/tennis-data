import { createServerSupabaseClient } from '@/lib/ingestion/autoImport'
import { runScheduledTennisRecordRatingBatch } from '@/lib/tennisrecord/service'

export const runtime = 'nodejs'
// This uses the existing full TiQ engine once per controlled cadence.
export const maxDuration = 300

export async function GET(request: Request) {
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
    return Response.json({ ok: true, summary: await runScheduledTennisRecordRatingBatch(service) })
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : 'Scheduled rating batch failed.' }, { status: 500 })
  }
}
