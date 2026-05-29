import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    absolute: 'Coach Hub | TenAceIQ',
  },
  description:
    'Coach Hub is the TenAceIQ workspace for lesson planning, assignments, Tactical Studio, and coach-player follow-through.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function CoachLayout({ children }: { children: ReactNode }) {
  return children
}
