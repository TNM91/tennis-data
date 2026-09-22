import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    absolute: 'Video Review | TenAceIQ',
  },
  description:
    'Record or upload tennis clips, request coach review, and return timestamped video feedback with markups.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function VideoReviewLayout({ children }: { children: ReactNode }) {
  return children
}
