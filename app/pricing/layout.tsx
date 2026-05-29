import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Pricing and Tiers',
  description:
    'Compare TenAceIQ Free, My Lab, Coach Hub, Team Hub, League Office, and Full-Court tiers for tennis discovery, prep, player development, team decisions, tournaments, and league operations.',
  path: '/pricing',
})

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children
}
