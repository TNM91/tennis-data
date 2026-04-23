import { unstable_cache } from 'next/cache'
import { fetchLeagueSummary } from '@/lib/league-summary'

const getCachedLeagueSummary = unstable_cache(
  fetchLeagueSummary,
  ['league-summary'],
  { revalidate: 300 } // 5-minute TTL
)

export async function GET() {
  try {
    const summary = await getCachedLeagueSummary()
    return Response.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load league summary.'
    return Response.json({ error: message }, { status: 500 })
  }
}
