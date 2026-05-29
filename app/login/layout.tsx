import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login',
  description:
    'Sign in to TenAceIQ and open the workspace tied to your role: My Lab, Coach Hub, Team Hub, or League Office.',
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
