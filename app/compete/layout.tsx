import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'League Office',
  description:
    'Operational workspace for active league seasons, team results, player results, schedules, and tournament handoffs.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function CompeteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
