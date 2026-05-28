export const dynamic = 'force-dynamic'

import SiteShell from '@/app/components/site-shell'
import TournamentBuilderWorkspace from '@/app/components/tournament-builder-workspace'

export default function LeagueTournamentBuilderPage() {
  return (
    <SiteShell active="/league-coordinator">
      <TournamentBuilderWorkspace />
    </SiteShell>
  )
}
