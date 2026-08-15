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
    console.error('League summary failed', error)
    return Response.json({ error: 'League summary could not be loaded.' }, { status: 500 })
  }
}
