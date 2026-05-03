import type { Metadata } from 'next'
import { getMatchupMetadata } from '@/lib/route-metadata'

export const metadata: Metadata = getMatchupMetadata()

export default function MatchupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
