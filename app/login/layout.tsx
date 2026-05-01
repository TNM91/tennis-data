import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login',
  description:
    'Sign in to TenAceIQ to access My Lab, Matchup, Captain tools, and League Coordinator tools tied to your account.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
