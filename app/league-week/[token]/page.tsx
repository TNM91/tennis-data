import SiteShell from '@/app/components/site-shell'
import WeeklyLeagueResponse from './weekly-league-response'

export default async function WeeklyLeagueResponsePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ preview?: string | string[] }>
}) {
  const { token } = await params
  const query = await searchParams
  const preview = Array.isArray(query.preview) ? query.preview[0] : query.preview
  return <SiteShell active="/leagues"><WeeklyLeagueResponse token={token} previewMode={preview === '1'} /></SiteShell>
}
