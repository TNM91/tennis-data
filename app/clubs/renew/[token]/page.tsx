import SiteShell from '@/app/components/site-shell'
import ClubRenewalResponse from '@/app/components/club-renewal-response'

export default async function ClubRenewalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <SiteShell active="/clubs">
      <ClubRenewalResponse token={token} />
    </SiteShell>
  )
}
