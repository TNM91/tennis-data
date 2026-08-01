import SiteShell from '@/app/components/site-shell'
import AvailabilityResponseClient from './availability-response-client'

export default async function AvailabilityResponsePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <SiteShell active="/availability">
      <AvailabilityResponseClient token={token} />
    </SiteShell>
  )
}
