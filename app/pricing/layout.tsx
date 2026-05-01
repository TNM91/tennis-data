import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Compare Free, Player, Captain, and TIQ League Coordinator plans for TenAceIQ.',
}

export default function PricingLayout({ children }: { children: ReactNode }) {
  return children
}
