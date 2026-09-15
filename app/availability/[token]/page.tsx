import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import AvailabilityResponseClient from './availability-response-client'
import { buildCaptainShareMetadata } from '@/lib/captain-share-preview'

export const metadata: Metadata = buildCaptainShareMetadata({ kind: 'availability' })

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
