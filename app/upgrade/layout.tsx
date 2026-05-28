import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Continue Your Plan',
  description:
    'Continue with the TenAceIQ tier that matches your tennis job: Player, Team, or League.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function UpgradeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
