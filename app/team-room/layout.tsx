import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: { absolute: 'Team Room | TenAceIQ' },
  description: 'Your team conversation, match details, availability, and captain updates in one place.',
  robots: { index: false, follow: false },
}

export default function TeamRoomLayout({ children }: { children: ReactNode }) {
  return children
}
