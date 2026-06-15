import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Compete',
  description:
    'Prepare for the next tennis match with matchup insight, scouting, lineup strategy, performance tracking, and team intelligence.',
  robots: {
    index: true,
    follow: true,
  },
}

export default function CompeteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
