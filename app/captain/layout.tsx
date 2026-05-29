import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Team Hub',
  description:
    'Use TenAceIQ Team Hub and Captain Tools for availability, lineups, scenarios, messaging, and weekly team decisions.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function CaptainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
