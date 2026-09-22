export const dynamic = 'force-dynamic'

import { IndividualLeagueResultsWorkspace } from '@/app/components/individual-league-results-workspace'

export default function LeagueCoordinatorIndividualResultsPage() {
  return (
    <IndividualLeagueResultsWorkspace
      activeRoute="/league-coordinator"
      loginNextHref="/league-coordinator/individual-results"
      loginPlanId="league"
    />
  )
}
