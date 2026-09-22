import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    absolute: 'Captain Season | TenAceIQ',
  },
  description:
    'Follow your team season, prepare the next match week, and move from availability to lineup and team communication.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function CaptainSeasonDashboardLayout({ children }: { children: ReactNode }) {
  return children
}
