import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Compete',
  description:
    'Weekly competition workflow for your active leagues, teams, schedule, and results.',
}

export default function CompeteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
