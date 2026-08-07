import type { Metadata } from 'next'
import PublicClubHome from '@/app/components/public-club-home'
import SiteShell from '@/app/components/site-shell'

type ClubPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ClubPageProps): Promise<Metadata> {
  const { slug } = await params
  const label = slug.split('-').filter(Boolean).map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`).join(' ')
  return {
    title: `${label || 'Club'} | TenAceIQ`,
    description: 'Club programs, leagues, tournaments, and tennis updates in one place.',
  }
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { slug } = await params
  return (
    <SiteShell active="/clubs">
      <PublicClubHome slug={slug} />
    </SiteShell>
  )
}
