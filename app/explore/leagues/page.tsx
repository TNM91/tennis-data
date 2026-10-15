import { getCachedLeagueSummary } from '@/lib/league-summary-server'
import LeaguesDirectoryClient from './leagues-directory-client'

export const revalidate = 300

export default async function ExploreLeaguesPage() {
  const { leagues, totalMatches, totalFlights, latestMatch, notice } = await getCachedLeagueSummary()
  return <LeaguesDirectoryClient initialSummary={{ leagues, totalMatches, totalFlights, latestMatch, notice }} />
}
