import type { Metadata } from 'next'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Find Tennis',
  description:
    'Search players, teams, leagues, locations, ratings, and tennis resources from one TenAceIQ starting point.',
  path: '/explore/search',
})

export default function ExploreSearchLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
