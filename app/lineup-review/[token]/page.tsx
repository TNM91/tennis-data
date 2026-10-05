import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import LineupReviewClient from './lineup-review-client'

export const metadata: Metadata = {
  title: { absolute: 'Proposed Lineup · Co-captain Review | TenAceIQ' },
  description: 'Review the proposed courts, suggest player changes, and send your lineup proposal back to the captain.',
  openGraph: {
    type: 'website',
    siteName: 'TenAceIQ',
    title: 'Proposed Lineup · Co-captain Review',
    description: 'Review the courts. Suggest changes. Send your proposal back.',
    images: [{ url: '/lineup-review/opengraph-image?v=20261005', width: 1200, height: 630, alt: 'Proposed Lineup — Co-captain Review' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Proposed Lineup · Co-captain Review',
    description: 'Review the courts. Suggest changes. Send your proposal back.',
    images: ['/lineup-review/opengraph-image?v=20261005'],
  },
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
}

export default async function LineupReviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return (
    <SiteShell active="/lineup-review">
      <LineupReviewClient token={token} />
    </SiteShell>
  )
}
