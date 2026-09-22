'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

// Do not load advertising or analytics on personal reply pages. Their secret
// is in the fragment so the page request itself never contains a reply token.
export default function SeasonPrivacyBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return pathname === '/season-availability' ? null : children
}
