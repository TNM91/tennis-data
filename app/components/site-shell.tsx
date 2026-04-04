'use client'

import type { ReactNode } from 'react'
import SiteHeader from '@/app/components/site-header'
import SiteFooter from '@/app/components/site-footer'
import { pageBackground, orbOne, orbTwo, gridGlow, topBlueWash } from '@/lib/design-system'

export default function SiteShell({ children, active }: { children: ReactNode; active?: string }) {
  return (
    <main style={pageBackground}>
      <div style={orbOne} />
      <div style={orbTwo} />
      <div style={gridGlow} />
      <div style={topBlueWash} />

      <SiteHeader active={active} />
      {children}
      <SiteFooter />
    </main>
  )
}
