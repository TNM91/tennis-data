import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    absolute: 'League Office | TenAceIQ',
  },
  description:
    'Use League Office to run leagues of players or teams with scheduling, standings, participation, and communication.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function LeagueCoordinatorLayout({ children }: { children: ReactNode }) {
  return children
}
