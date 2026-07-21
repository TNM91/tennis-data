export const dynamic = 'force-dynamic'

import { TeamLeagueResultsWorkspace } from '@/app/components/team-league-results-workspace'

export default function CaptainTiqTeamMatchesPage() {
  return (
    <TeamLeagueResultsWorkspace
      activeRoute="/league-coordinator"
      loginNextHref="/captain/tiq-team-matches"
      loginPlanId="league"
      resultsHref="/captain/tiq-team-matches"
    />
  )
}
