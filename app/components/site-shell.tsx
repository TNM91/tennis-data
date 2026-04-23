'use client'

import type { ReactNode } from 'react'
import SiteHeader from '@/app/components/site-header'
import SiteFooter from '@/app/components/site-footer'
import { AuthProvider } from '@/app/components/auth-provider'
import { pageBackground, orbOne, orbTwo, gridGlow, topBlueWash } from '@/lib/design-system'

export default function SiteShell({ children, active }: { children: ReactNode; active?: string }) {
  return (
    <AuthProvider>
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          top: '-100%',
          left: 12,
          zIndex: 9999,
          padding: '10px 18px',
          borderRadius: 12,
          background: 'var(--brand-green)',
          color: 'var(--text-dark)',
          fontWeight: 800,
          fontSize: '0.9rem',
          textDecoration: 'none',
          transition: 'top 0.1s',
        }}
        onFocus={(e) => { e.currentTarget.style.top = '12px' }}
        onBlur={(e) => { e.currentTarget.style.top = '-100%' }}
      >
        Skip to main content
      </a>
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
        <div id="main-content" className="page-reveal">{children}</div>
        <SiteFooter />
      </main>
    </AuthProvider>
  )
}
