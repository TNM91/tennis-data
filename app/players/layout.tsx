import type { Metadata } from 'next'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Player Ratings & Profiles',
  description:
    'Browse player ratings, dynamic performance scores, and match history across USTA and TIQ competition on TenAceIQ.',
  path: '/players',
})

export default function PlayersLayout({ children }: { children: React.ReactNode }) {
  return children
}
