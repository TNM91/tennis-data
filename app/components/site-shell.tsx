'use client'

import type { ReactNode } from 'react'
import SiteHeader from '@/app/components/site-header'
import SiteFooter from '@/app/components/site-footer'
import { AuthProvider } from '@/app/components/auth-provider'
import { pageBackground, orbOne, orbTwo, gridGlow, topBlueWash } from '@/lib/design-system'

export default function SiteShell({ children, active }: { children: ReactNode; active?: string }) {
  return (
    <AuthProvider>
      <main
        style={{
          ...pageBackground,
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        }}
      >
        <div style={orbOne} />
        <div style={orbTwo} />
        <div style={gridGlow} />
        <div style={topBlueWash} />

        <SiteHeader active={active} />
        <div className="page-reveal">{children}</div>
        <SiteFooter />
      </main>
    </AuthProvider>
  )
}
