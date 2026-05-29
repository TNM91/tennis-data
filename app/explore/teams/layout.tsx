import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Find Teams',
  description:
    'Find tennis teams by team name, league, club, captain, flight, and match-week context across TenAceIQ.',
  path: '/explore/teams',
})

export default function ExploreTeamsLayout({ children }: { children: ReactNode }) {
  return children
}
