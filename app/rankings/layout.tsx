import type { Metadata } from 'next'
import { getRankingsMetadata } from '@/lib/route-metadata'
import { PublicCompetitionContentProvider } from '@/app/components/public-competition-content-context'
import { PublicRankingsSnapshot } from '@/app/components/public-competition-evidence'

export const revalidate = 86400

export const metadata: Metadata = getRankingsMetadata()

export default function RankingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PublicCompetitionContentProvider rankingsContent={<PublicRankingsSnapshot />}>{children}</PublicCompetitionContentProvider>
}
