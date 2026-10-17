import { unstable_cache } from 'next/cache'
import { fetchLeagueSummary } from '@/lib/league-summary'

// Share the API cache with the initial directory render.
export const getCachedLeagueSummary = unstable_cache(
  fetchLeagueSummary,
  ['league-summary'],
  { revalidate: 300 },
)
