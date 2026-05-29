'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import SiteHeader from '@/app/components/site-header'
import SiteFooter from '@/app/components/site-footer'
import PortalToolBar from '@/app/components/portal-tool-bar'
import { AuthProvider } from '@/app/components/auth-provider'
import { pageBackground, orbOne, orbTwo, gridGlow, topBlueWash } from '@/lib/design-system'

export default function SiteShell({ children, active }: { children: ReactNode; active?: string }) {
  return (
    <AuthProvider>
      <SiteShellContent active={active}>{children}</SiteShellContent>
    </AuthProvider>
  )
}

function SiteShellContent({ children, active }: { children: ReactNode; active?: string }) {
  const pathname = usePathname() || '/'
  const atmosphereClassName = getBrandAtmosphereClassName(pathname)

  return (
      <main
        className={pathname.startsWith('/player-development') ? 'player-development-site-shell' : undefined}
        style={{
          ...pageBackground,
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        }}
      >
        <div style={orbOne} />
        <div style={orbTwo} />
        <div style={gridGlow} />
        <div style={topBlueWash} />
        <div className={atmosphereClassName} aria-hidden="true" />

        <SiteHeader active={active} />
        <PortalToolBar />
        <div id="main-content" className="page-reveal">{children}</div>
        <SiteFooter />
      </main>
  )
}

function getBrandAtmosphereClassName(pathname: string) {
  const hubRoutes = new Set(['/', '/mylab', '/coach', '/captain', '/league-coordinator', '/admin'])
  const quietPrefixes = [
    '/admin/',
    '/coach/',
    '/captain/',
    '/league-coordinator/results',
    '/league-coordinator/individual-results',
    '/profile',
    '/login',
    '/pricing',
  ]

  if (quietPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return 'brand-atmosphere-mark brand-atmosphere-mark--quiet'
  }

  if (hubRoutes.has(pathname)) {
    return 'brand-atmosphere-mark brand-atmosphere-mark--hub'
  }

  return 'brand-atmosphere-mark'
}
