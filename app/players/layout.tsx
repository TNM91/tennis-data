import type { Metadata } from 'next'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { PublicPlayerContentProvider } from '@/app/components/public-player-content-context'
import PublicPlayerDiscovery from '@/app/components/public-player-evidence'

export const revalidate = 86400

export const metadata: Metadata = buildRouteMetadata({
  title: 'Player Ratings & Profiles',
  description:
    'Browse player ratings, dynamic performance scores, and match history across USTA and TIQ competition on TenAceIQ.',
  path: '/players',
})

export default function PlayersLayout({ children }: { children: React.ReactNode }) {
  return <PublicPlayerContentProvider directoryContent={<PublicPlayerDiscovery />}>{children}</PublicPlayerContentProvider>
}
