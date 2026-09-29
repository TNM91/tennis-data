import SiteShell from '@/app/components/site-shell'
import WeeklyLeagueWorkspace from './weekly-league-workspace'

export default async function WeeklyLeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ leagueId?: string | string[] }>
}) {
  const params = await searchParams
  const leagueId = Array.isArray(params.leagueId) ? params.leagueId[0] : params.leagueId || ''

  return (
    <SiteShell active="/league-coordinator">
      <WeeklyLeagueWorkspace initialLeagueId={leagueId} />
    </SiteShell>
  )
}
