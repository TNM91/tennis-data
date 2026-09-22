import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import LineupReviewClient from './lineup-review-client'

export const metadata: Metadata = {
  title: 'Private lineup review | TenAceIQ',
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
