export const dynamic = 'force-dynamic'

import { LeagueCoordinatorWorkspace } from '@/app/components/league-coordinator-workspace'
import SiteShell from '@/app/components/site-shell'

export default function LeagueCoordinatorPage() {
  return (
    <SiteShell active="/league-coordinator">
      <LeagueCoordinatorWorkspace />
    </SiteShell>
  )
}
