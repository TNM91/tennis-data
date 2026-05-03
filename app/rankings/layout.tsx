import type { Metadata } from 'next'
import { getRankingsMetadata } from '@/lib/route-metadata'

export const metadata: Metadata = getRankingsMetadata()

export default function RankingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
