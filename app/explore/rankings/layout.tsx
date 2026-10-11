import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { PublicCompetitionContentProvider } from '@/app/components/public-competition-content-context'
import { PublicRankingsSnapshot } from '@/app/components/public-competition-evidence'

export const revalidate = 86400

export const metadata: Metadata = buildRouteMetadata({
  title: 'Explore Rankings',
  description:
    'Check the tennis field by overall, singles, doubles, activity, and location context across TenAceIQ.',
  path: '/explore/rankings',
})

export default function ExploreRankingsLayout({ children }: { children: ReactNode }) {
  return <PublicCompetitionContentProvider rankingsContent={<PublicRankingsSnapshot />}>{children}</PublicCompetitionContentProvider>
}
