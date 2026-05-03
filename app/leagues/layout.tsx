import type { Metadata } from 'next'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Leagues',
  description:
    'Browse USTA and TIQ league seasons, flight standings, and team records on TenAceIQ.',
  path: '/leagues',
})

export default function LeaguesLayout({ children }: { children: React.ReactNode }) {
  return children
}
