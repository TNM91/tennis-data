import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Password Reset',
  description: 'Request a private TenAceIQ password reset link.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ForgetPasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
