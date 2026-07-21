'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import SiteHeader from '@/app/components/site-header'
import SiteFooter from '@/app/components/site-footer'
import PortalToolBar from '@/app/components/portal-tool-bar'
import { AuthProvider } from '@/app/components/auth-provider'
import { pageBackground, orbOne, orbTwo, gridGlow, topBlueWash } from '@/lib/design-system'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

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
  const { screenWidth, isTablet } = useViewportBreakpoints()
  const atmosphereClassName = getBrandAtmosphereClassName(pathname)
  const lastPathnameRef = useRef(pathname)
  const [compactSiteMenuOpen, setCompactSiteMenuOpen] = useState(false)
  const usePortalRailLayout = showPortalToolBar && screenWidth >= 820
  const portalRailWidth = isTablet ? 252 : 304

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

        <SiteHeader
          active={active}
          railLayout={usePortalRailLayout}
          onCompactMenuOpenChange={setCompactSiteMenuOpen}
        />
        {usePortalRailLayout ? (
          <div
            style={{
              ...portalRailLayoutStyle,
              paddingLeft: 16 + portalRailWidth + 16,
            }}
          >
            <aside
              data-portal-rail="true"
              style={{
                ...portalRailAsideStyle,
                width: portalRailWidth,
              }}
            >
              <PortalToolBar layout="rail" />
            </aside>
            <div data-portal-content-scroll="true" style={portalRailScrollStyle}>
              <div id="main-content" className="page-reveal" style={portalRailMainStyle}>{children}</div>
              <SiteFooter railLayout railWidth={0} />
            </div>
          </div>
        ) : (
          <>
            {showPortalToolBar ? <PortalToolBar suppressed={compactSiteMenuOpen} /> : null}
            <div id="main-content" className="page-reveal">{children}</div>
            <SiteFooter railLayout={false} railWidth={portalRailWidth} />
          </>
        )}
      </main>
  )
}

const portalRailLayoutStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'block',
  width: 'min(1280px, 100%)',
  maxWidth: '100vw',
  minWidth: 0,
  height: 'calc(100dvh - var(--header-height))',
  margin: '0 auto',
  padding: '10px 16px 0',
  boxSizing: 'border-box',
  overflow: 'hidden',
  overflowX: 'clip',
}

const portalRailAsideStyle: CSSProperties = {
  position: 'fixed',
  top: 'calc(var(--header-height) + 10px)',
  left: 'max(16px, calc((100vw - 1280px) / 2 + 16px))',
  zIndex: 24,
  minWidth: 0,
  height: 'calc(100dvh - var(--header-height) - 20px)',
  maxHeight: 'calc(100dvh - var(--header-height) - 20px)',
  overflow: 'auto',
}

const portalRailMainStyle: CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
}

const portalRailScrollStyle: CSSProperties = {
  height: '100%',
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  overflowY: 'auto',
  overflowX: 'clip',
  WebkitOverflowScrolling: 'touch',
  overscrollBehavior: 'contain',
  scrollBehavior: 'smooth',
}

function getBrandAtmosphereClassName(pathname: string) {
  const hubRoutes = new Set(['/', '/mylab', '/coach', '/captain', '/league-coordinator', '/admin'])
  const authRoutes = new Set(['/login', '/join', '/forget-password', '/reset-password'])
  const quietPrefixes = [
    '/admin/',
    '/coach/',
    '/captain/',
    '/league-coordinator/results',
    '/league-coordinator/individual-results',
    '/explore/search',
    '/profile',
    '/login',
    '/pricing',
  ]

  if (authRoutes.has(pathname)) {
    return 'brand-atmosphere-mark brand-atmosphere-mark--auth'
  }

  if (quietPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return 'brand-atmosphere-mark brand-atmosphere-mark--quiet'
  }

  if (hubRoutes.has(pathname)) {
    return 'brand-atmosphere-mark brand-atmosphere-mark--hub'
  }

  return 'brand-atmosphere-mark'
}
