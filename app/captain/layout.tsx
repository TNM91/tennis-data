import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Captain Workspace',
  description:
    'Use the TenAceIQ Captain workspace for availability, lineups, scenarios, messaging, and weekly team decisions.',
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
