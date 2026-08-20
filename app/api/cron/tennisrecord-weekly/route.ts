import { createServerSupabaseClient } from '@/lib/ingestion/autoImport'
import { runScheduledTennisRecordSync } from '@/lib/tennisrecord/service'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false, message: 'Weekly collector is not authorized.' }, { status: 401 })
  try {
    const service = createServerSupabaseClient()
    return Response.json({ ok: true, summary: await runScheduledTennisRecordSync(service, 'weekly') })
  } catch (error) {
    return Response.json({ ok: false, message: error instanceof Error ? error.message : 'Weekly collector failed.' }, { status: 500 })
  }
}
