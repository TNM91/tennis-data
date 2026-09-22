import { createServerSupabaseClient } from '@/lib/ingestion/autoImport'
import { runAutomaticTennisRecordSync } from '@/lib/tennisrecord/service'

export const runtime = 'nodejs'
// The collector uses small, resumable checkpoints and may trigger a TenAceIQ
// rating recalculation. Retain enough time for the bounded work to finish.
export const maxDuration = 300

export async function GET(request: Request) {
  const startedAt = Date.now()
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, message: 'Automated collector is not authorized.' }, { status: 401 })

  // Keep an operational circuit breaker outside the database. When the
  // collector is creating pressure, this prevents a new cron invocation from
  // adding more work while existing requests drain. The resumable queue and
  // all captured evidence remain untouched.
  const collectorFlag = process.env.TENNISRECORD_COLLECTOR_ENABLED?.trim().toLowerCase()
  if (collectorFlag === 'false' || collectorFlag === '0' || collectorFlag === 'off') {
    return Response.json({ ok: true, summary: { status: 'disabled' }, message: 'TennisRecord collector is paused by the operational circuit breaker.' })
  }

  try {
    const service = createServerSupabaseClient()
    const summary = await runAutomaticTennisRecordSync(service)
    console.info('[api/cron/tennisrecord-automation] completed', {
      durationMs: Date.now() - startedAt,
      status: summary.status,
      pagesAttempted: summary.pagesAttempted,
      pagesProcessed: summary.pagesProcessed,
    })
    return Response.json({ ok: true, summary })
  } catch (error) {
    console.error('[api/cron/tennisrecord-automation] failed', {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, message: error instanceof Error ? error.message : 'Automated collector failed.' }, { status: 500 })
  }
}
