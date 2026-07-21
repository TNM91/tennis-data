import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    absolute: 'Messages | TenAceIQ',
  },
  description: 'Private TenAceIQ messages for players, coaches, captains, and league work.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return children
}
