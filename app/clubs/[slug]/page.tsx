import type { Metadata } from 'next'
import PublicClubHome from '@/app/components/public-club-home'
import SiteShell from '@/app/components/site-shell'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildShareCardImageUrl } from '@/lib/share-card'

type ClubPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ClubPageProps): Promise<Metadata> {
  const { slug } = await params
  const label = slug.split('-').filter(Boolean).map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`).join(' ')
  const title = label || 'Club'
  return buildRouteMetadata({
    title,
    description: 'Club programs, leagues, tournaments, and tennis updates in one place.',
    path: `/clubs/${encodeURIComponent(slug)}`,
    image: buildShareCardImageUrl({ kind: 'club', title, subtitle: 'Club tennis home', detail: 'Programs · Teams · Leagues · Events' }),
  })
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { slug } = await params
  return (
    <SiteShell active="/clubs">
      <PublicClubHome slug={slug} />
    </SiteShell>
  )
}
