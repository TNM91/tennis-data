import SiteShell from '@/app/components/site-shell'
import WeeklyLeagueResponse from './weekly-league-response'

export default async function WeeklyLeagueResponsePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SiteShell active="/leagues"><WeeklyLeagueResponse token={token} /></SiteShell>
}
