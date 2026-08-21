import { createServerSupabaseClient } from '@/lib/ingestion/autoImport'
import { runAutomaticTennisRecordSync } from '@/lib/tennisrecord/service'

export const runtime = 'nodejs'
// The collector uses small, resumable checkpoints and may trigger a TenAceIQ
// rating recalculation. Retain enough time for the bounded work to finish.
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
