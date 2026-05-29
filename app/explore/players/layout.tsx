import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Find Players',
  description:
    'Find tennis players by name, location, team, league, or rating context across TenAceIQ.',
  path: '/explore/players',
})

export default function ExplorePlayersLayout({ children }: { children: ReactNode }) {
  return children
}
