import { createServerSupabaseClient } from '@/lib/ingestion/autoImport'
import { runAutomaticTennisRecordSync } from '@/lib/tennisrecord/service'

export const runtime = 'nodejs'
// A single page can trigger reconciliation and a TenAceIQ rating recalculation.
// On Pro, retain the one-page checkpoint but allow that bounded work to finish.
export const maxDuration = 300

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, message: 'Automated collector is not authorized.' }, { status: 401 })
  try {
    const service = createServerSupabaseClient()
    return Response.json({ ok: true, summary: await runAutomaticTennisRecordSync(service) })
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : 'Automated collector failed.' }, { status: 500 })
  }
}
