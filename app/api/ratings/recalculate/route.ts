import { createServerSupabaseClient } from '@/lib/ingestion/autoImport'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'

export const runtime = 'nodejs'

export async function POST() {
  let supabase: ReturnType<typeof createServerSupabaseClient>

  try {
    supabase = createServerSupabaseClient()
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Server rating configuration is missing',
      },
      { status: 500 },
    )
  }

  try {
    await recalculateDynamicRatings(undefined, supabase)
    return Response.json({ ok: true, message: 'All dynamic ratings recalculated.' })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Rating recalculation failed',
      },
      { status: 500 },
    )
  }
}
