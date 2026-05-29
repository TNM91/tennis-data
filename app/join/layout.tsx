import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Join',
  description:
    'Create a TenAceIQ account to start free and unlock My Lab, Coach Hub, Team Hub, League Office, or Full-Court when you need them.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
