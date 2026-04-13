import type { Metadata } from 'next'
import { getExploreMetadata } from '@/lib/route-metadata'

export const metadata: Metadata = getExploreMetadata()

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
