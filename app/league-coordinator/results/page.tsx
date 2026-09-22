export const dynamic = 'force-dynamic'

import { TeamLeagueResultsWorkspace } from '@/app/components/team-league-results-workspace'

export default function LeagueCoordinatorResultsPage() {
  return (
    <TeamLeagueResultsWorkspace
      activeRoute="/league-coordinator"
      loginNextHref="/league-coordinator/results"
      loginPlanId="league"
    />
  )
}
