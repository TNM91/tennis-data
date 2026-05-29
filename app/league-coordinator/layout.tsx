import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    absolute: 'League Office | TenAceIQ',
  },
  description:
    'Use League Office to run leagues of players or teams with setup, scoring, standings, participation, and results.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function LeagueCoordinatorLayout({ children }: { children: ReactNode }) {
  return children
}
