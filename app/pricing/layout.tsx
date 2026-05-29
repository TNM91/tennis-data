import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Pricing and Tiers',
  description:
    'Compare TenAceIQ Free, Player, Coach, Captain, League, and Full-Court tiers for tennis discovery, prep, player development, team decisions, tournaments, and league operations.',
  openGraph: {
    title: 'TenAceIQ Pricing and Tiers',
    description:
      'Choose the right TenAceIQ tier for free discovery, Player insight, Coach development, Captain decisions, League operations, or Full-Court.',
    url: '/pricing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TenAceIQ Pricing and Tiers',
    description:
      'Choose the right TenAceIQ tier for free discovery, Player insight, Coach development, Captain decisions, League operations, or Full-Court.',
  },
}

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children
}
