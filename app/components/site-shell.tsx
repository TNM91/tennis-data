'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import SiteHeader from '@/app/components/site-header'
import SiteFooter from '@/app/components/site-footer'
import PortalToolBar from '@/app/components/portal-tool-bar'
import { AuthProvider } from '@/app/components/auth-provider'
import { pageBackground, orbOne, orbTwo, gridGlow, topBlueWash } from '@/lib/design-system'

type SiteShellProps = {
  children: ReactNode
  active?: string
  showPortalToolBar?: boolean
}

export default function SiteShell({ children, active, showPortalToolBar = true }: SiteShellProps) {
  return (
    <AuthProvider>
      <SiteShellContent active={active} showPortalToolBar={showPortalToolBar}>{children}</SiteShellContent>
    </AuthProvider>
  )
}

function SiteShellContent({ children, active, showPortalToolBar }: SiteShellProps) {
  const pathname = usePathname() || '/'
  const atmosphereClassName = getBrandAtmosphereClassName(pathname)
  const lastPathnameRef = useRef(pathname)

  useEffect(() => {
    const storageKey = `tenaceiq.shell.scroll.${pathname}`
    let restored = false

    function persistScrollPosition() {
      try {
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            y: Math.max(0, Math.round(window.scrollY)),
            savedAt: Date.now(),
          }),
        )
      } catch {
        // Session storage is best-effort; navigation should never depend on it.
      }
    }

    function restoreScrollPosition() {
      if (restored || window.location.hash) return
      restored = true

      try {
        const raw = window.sessionStorage.getItem(storageKey)
        if (!raw) return

        const saved = JSON.parse(raw) as { y?: number; savedAt?: number }
        const y = typeof saved.y === 'number' ? saved.y : 0
        const savedAt = typeof saved.savedAt === 'number' ? saved.savedAt : 0
        if (y <= 0 || Date.now() - savedAt > 1000 * 60 * 60 * 8) return

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: y, behavior: 'instant' })
          })
        })
      } catch {
        window.sessionStorage.removeItem(storageKey)
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') persistScrollPosition()
    }

    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname
      window.scrollTo({ top: 0, behavior: 'instant' })
    }

    restoreScrollPosition()

    window.addEventListener('pagehide', persistScrollPosition)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      persistScrollPosition()
      window.removeEventListener('pagehide', persistScrollPosition)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pathname])

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
        {showPortalToolBar ? <PortalToolBar /> : null}
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
