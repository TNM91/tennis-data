import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Continue Your Plan',
  description:
    'Continue with the TenAceIQ tier that matches your tennis need: My Lab, Coach Hub, Team Hub, League Office, or Full-Court.',
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
