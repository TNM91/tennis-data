import type { Metadata } from 'next'
import ClubInviteAcceptance from '@/app/components/club-invite-acceptance'
import SiteShell from '@/app/components/site-shell'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildShareCardImageUrl } from '@/lib/share-card'
import { getClubInviteSharePreview } from '@/lib/private-share-previews'

type ClubInvitePageProps = {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: ClubInvitePageProps): Promise<Metadata> {
  const { token } = await params
  const preview = await getClubInviteSharePreview(token)
  const destination = preview?.targetName || preview?.clubName || 'your club'
  const title = `Join ${destination}`
  const description = `Open your secure TenAceIQ invitation to join ${destination}.`
  return {
    ...buildRouteMetadata({
      title,
      description,
      path: `/clubs/invite/${encodeURIComponent(token)}`,
      image: buildShareCardImageUrl({ kind: 'club', title, subtitle: preview?.clubName || 'Club invitation', detail: preview?.roles.length ? preview.roles.join(' · ') : 'Secure club invitation' }),
    }),
    robots: { index: false, follow: false },
  }
}

export default async function ClubInvitePage({ params }: ClubInvitePageProps) {
  const { token } = await params
  return (
    <SiteShell active="/clubs">
      <ClubInviteAcceptance token={token} />
    </SiteShell>
  )
}
