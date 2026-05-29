import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    absolute: 'Profile | TenAceIQ',
  },
  description: 'Private TenAceIQ account, player link, preferences, and billing profile.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children
}
