import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Pricing and Tiers',
  description:
    'Compare TenAceIQ Free, Player, Captain, and TIQ League Coordinator tiers for tennis discovery, personal prep, team decisions, and league operations.',
  openGraph: {
    title: 'TenAceIQ Pricing and Tiers',
    description:
      'Choose the right TenAceIQ tier for free discovery, Player insight, Captain tools, or league operations.',
    url: '/pricing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TenAceIQ Pricing and Tiers',
    description:
      'Choose the right TenAceIQ tier for free discovery, Player insight, Captain tools, or league operations.',
  },
}

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children
}
