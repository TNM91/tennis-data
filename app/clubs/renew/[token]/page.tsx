import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import ClubRenewalResponse from '@/app/components/club-renewal-response'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildShareCardImageUrl } from '@/lib/share-card'
import { getClubRenewalSharePreview } from '@/lib/private-share-previews'

type ClubRenewalPageProps = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: ClubRenewalPageProps): Promise<Metadata> {
  const { token } = await params
  const preview = await getClubRenewalSharePreview(token)
  const title = `${preview?.groupName || 'Club program'} season confirmation`
  const description = `${preview?.playerName ? `${preview.playerName}, confirm` : 'Confirm'} whether you are returning${preview?.seasonLabel ? ` for ${preview.seasonLabel}` : ''}.`
  return {
    ...buildRouteMetadata({
      title,
      description,
      path: `/clubs/renew/${encodeURIComponent(token)}`,
      image: buildShareCardImageUrl({ kind: 'club', title, subtitle: preview?.clubName || 'Club tennis', detail: preview?.seasonLabel || 'Season confirmation' }),
    }),
    robots: { index: false, follow: false },
  }
}

export default async function ClubRenewalPage({ params }: ClubRenewalPageProps) {
  const { token } = await params
  return (
    <SiteShell active="/clubs">
      <ClubRenewalResponse token={token} />
    </SiteShell>
  )
}
