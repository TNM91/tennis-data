'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

// Keep advertising and analytics off personal reply and private chat pages.
export default function SeasonPrivacyBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return pathname === '/season-availability' || pathname === '/chats' || pathname.startsWith('/chats/') ? null : children
}
