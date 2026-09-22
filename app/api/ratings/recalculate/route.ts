import { createServerSupabaseClient } from '@/lib/ingestion/autoImport'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'
import { getAdminApiAuth } from '@/lib/server-api-auth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const adminAuth = await getAdminApiAuth(request)
  if (!adminAuth.ok) return adminAuth.response

  let supabase: ReturnType<typeof createServerSupabaseClient>

  try {
    supabase = createServerSupabaseClient()
  } catch (error) {
    console.error('Rating recalculation service initialization failed', error)
    return Response.json(
      {
        ok: false,
        message: 'Rating recalculation is temporarily unavailable.',
      },
      { status: 500 },
    )
  }

  try {
    await recalculateDynamicRatings(undefined, supabase)
    return Response.json({ ok: true, message: 'All dynamic ratings recalculated.' })
  } catch (error) {
    console.error('Rating recalculation failed', error)
    return Response.json(
      {
        ok: false,
        message: 'Rating recalculation failed. Try again or review server logs.',
      },
      { status: 500 },
    )
  }
}
