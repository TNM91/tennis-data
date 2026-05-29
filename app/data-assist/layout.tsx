import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Data Assist',
  description:
    'Fix tennis data with reviewed scorecard, schedule, roster, team summary, and correction uploads that improve TenAceIQ trust signals.',
  path: '/data-assist',
})

export default function DataAssistLayout({ children }: { children: ReactNode }) {
  return children
}
