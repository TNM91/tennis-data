import type { Metadata } from 'next'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Teams',
  description:
    'Explore team rosters, recent match results, and roster depth ratings across USTA and TIQ leagues on TenAceIQ.',
  path: '/teams',
})

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return children
}
