import ClubInviteAcceptance from '@/app/components/club-invite-acceptance'
import SiteShell from '@/app/components/site-shell'

type ClubInvitePageProps = {
  params: Promise<{ token: string }>
}

export default async function ClubInvitePage({ params }: ClubInvitePageProps) {
  const { token } = await params
  return (
    <SiteShell active="/clubs">
      <ClubInviteAcceptance token={token} />
    </SiteShell>
  )
}
