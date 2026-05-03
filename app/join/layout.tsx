import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Join',
  description:
    'Create a TenAceIQ account to start free and unlock Player, Captain, or TIQ League Coordinator tools when you need them.',
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
