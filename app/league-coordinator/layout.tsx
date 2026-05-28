import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    absolute: 'League Coordinator | TenAceIQ',
  },
  description:
    'Use TIQ League Coordinator to run leagues of players or teams with setup, scoring, standings, participation, and results.',
}

export default function LeagueCoordinatorLayout({ children }: { children: ReactNode }) {
  return children
}
