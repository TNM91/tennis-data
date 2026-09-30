import SiteShell from '@/app/components/site-shell'
import LeagueDelegateAcceptance from './league-delegate-acceptance'

export default async function LeagueDelegatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <SiteShell active="/league-coordinator">
      <LeagueDelegateAcceptance token={token} />
    </SiteShell>
  )
}
