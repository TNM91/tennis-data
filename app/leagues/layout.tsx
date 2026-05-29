import type { Metadata } from 'next'
import { buildRouteMetadata } from '@/lib/route-metadata'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Leagues',
  description:
    'Run the season without the spreadsheet chaos. Find leagues, follow standings, or open League Office for schedules, results, corrections, and messages.',
  path: '/leagues',
})

export default function LeaguesLayout({ children }: { children: React.ReactNode }) {
  return children
}
