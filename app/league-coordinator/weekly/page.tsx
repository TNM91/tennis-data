import SiteShell from '@/app/components/site-shell'
import WeeklyLeagueWorkspace from './weekly-league-workspace'

export default async function WeeklyLeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ leagueId?: string | string[]; playOn?: string | string[] }>
}) {
  const params = await searchParams
  const leagueId = Array.isArray(params.leagueId) ? params.leagueId[0] : params.leagueId || ''
  const requestedPlayOn = Array.isArray(params.playOn) ? params.playOn[0] : params.playOn || ''
  const playOn = /^\d{4}-\d{2}-\d{2}$/.test(requestedPlayOn) ? requestedPlayOn : ''

  return (
    <SiteShell active="/league-coordinator" showPortalToolBar={false}>
      <WeeklyLeagueWorkspace initialLeagueId={leagueId} initialPlayOn={playOn} />
    </SiteShell>
  )
}
