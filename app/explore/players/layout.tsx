import type { Metadata } from 'next'
import { PublicPlayerContentProvider } from '@/app/components/public-player-content-context'
import PublicPlayerDiscovery from '@/app/components/public-player-evidence'

import type { ReactNode } from 'react'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const revalidate = 86400

export const metadata: Metadata = buildRouteMetadata({
  title: 'Find Players',
  description:
    'Find tennis players by name, location, team, league, or rating context across TenAceIQ.',
  path: '/explore/players',
})

export default function ExplorePlayersLayout({ children }: { children: ReactNode }) {
  return <PublicPlayerContentProvider directoryContent={<PublicPlayerDiscovery />}>{children}</PublicPlayerContentProvider>
}
