import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Find Leagues',
  description:
    'Find tennis leagues by league, flight, section, district, season, rating, and competition layer across TenAceIQ.',
  path: '/explore/leagues',
})

export default function ExploreLeaguesLayout({ children }: { children: ReactNode }) {
  return children
}
