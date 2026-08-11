'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import SiteHeader from '@/app/components/site-header'
import SiteFooter from '@/app/components/site-footer'
import PortalToolBar from '@/app/components/portal-tool-bar'
import TeamConnectionInvite from '@/app/components/team-connection-invite'
import LevelUpCoachAlert from '@/app/components/level-up-coach-alert'
import { AuthProvider } from '@/app/components/auth-provider'
import { pageBackground, orbOne, orbTwo, gridGlow, topBlueWash } from '@/lib/design-system'
import { shouldUseFocusedSiteShell } from '@/lib/site-shell-focus'
import ContextualTennisVisual, { type ContextualTennisVisualName } from '@/app/components/contextual-tennis-visual'

type SiteShellProps = {
  children: ReactNode
  active?: string
  showPortalToolBar?: boolean
  appMode?: boolean
}

const PLATFORM_VISUAL_AREAS = [
  { name: 'improve', prefixes: ['/mylab', '/player-development', '/level-up'] },
  { name: 'coach', prefixes: ['/coach', '/coaches'] },
  { name: 'compete', prefixes: ['/compete', '/matchup', '/tournaments'] },
  { name: 'captain', prefixes: ['/captain'] },
  { name: 'league', prefixes: ['/league-coordinator', '/leagues', '/leagues-and-tournaments'] },
  { name: 'club', prefixes: ['/clubs'] },
  { name: 'explore', prefixes: ['/explore', '/players', '/teams', '/rankings'] },
  { name: 'manage', prefixes: ['/manage'] },
  { name: 'resources', prefixes: ['/resources'] },
] as const

export default function SiteShell({ children, active, showPortalToolBar = true, appMode = false }: SiteShellProps) {
  return (
    <AuthProvider>
      <SiteShellContent active={active} showPortalToolBar={showPortalToolBar} appMode={appMode}>{children}</SiteShellContent>
    </AuthProvider>
  )
}

function SiteShellContent({ children, active, showPortalToolBar, appMode = false }: SiteShellProps) {
  const pathname = usePathname() || '/'
  const compactAppMode = appMode || pathname === '/team-room'
  const focusedShell = shouldUseFocusedSiteShell(pathname)
  const atmosphereClassName = getBrandAtmosphereClassName(pathname)
  const visualArea = getPlatformVisualArea(pathname)
  const visualMode = getPlatformVisualMode(pathname)
  const visualSurface = getPlatformVisualSurface(pathname)
  const contextualAtmosphereVisual = getContextualAtmosphereVisual(visualArea)
  const lastPathnameRef = useRef(pathname)
  const [compactSiteMenuOpen, setCompactSiteMenuOpen] = useState(false)

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
        data-platform-area={visualArea}
        data-platform-mode={visualMode}
        data-platform-surface={visualSurface}
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
        {contextualAtmosphereVisual ? (
          <ContextualTennisVisual mode="atmosphere" visual={contextualAtmosphereVisual} />
        ) : null}

        {!compactAppMode ? (
          <SiteHeader
            active={active}
            railLayout={false}
            onCompactMenuOpenChange={setCompactSiteMenuOpen}
          />
        ) : null}
        {!compactAppMode && !focusedShell && showPortalToolBar ? <PortalToolBar suppressed={compactSiteMenuOpen} /> : null}
        {!compactAppMode && !focusedShell ? <LevelUpCoachAlert /> : null}
        {!compactAppMode && !focusedShell ? <TeamConnectionInvite /> : null}
        <div id="main-content" className="page-reveal">{children}</div>
        {!compactAppMode && !focusedShell ? <SiteFooter railLayout={false} railWidth={0} /> : null}
      </main>
  )
}

function getBrandAtmosphereClassName(pathname: string) {
  const hubRoutes = new Set(['/', '/mylab', '/coach', '/captain', '/league-coordinator', '/clubs', '/admin'])
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

  if (pathname === '/') {
    return 'brand-atmosphere-mark brand-atmosphere-mark--home'
  }

  const visualMode = getPlatformVisualMode(pathname)
  const visualArea = getPlatformVisualArea(pathname)

  if (quietPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return `brand-atmosphere-mark brand-atmosphere-mark--detail brand-atmosphere-mark--quiet brand-atmosphere-mark--${visualMode} brand-atmosphere-mark--area-${visualArea}`
  }

  if (hubRoutes.has(pathname)) {
    return `brand-atmosphere-mark brand-atmosphere-mark--hub brand-atmosphere-mark--${visualMode} brand-atmosphere-mark--area-${visualArea}`
  }

  return `brand-atmosphere-mark brand-atmosphere-mark--detail brand-atmosphere-mark--${visualMode} brand-atmosphere-mark--area-${visualArea}`
}

function getPlatformVisualSurface(pathname: string) {
  const hubRoutes = new Set(['/', '/mylab', '/coach', '/captain', '/league-coordinator', '/clubs', '/admin'])
  const authRoutes = new Set(['/login', '/join', '/forget-password', '/reset-password'])

  if (authRoutes.has(pathname)) return 'auth'
  if (hubRoutes.has(pathname)) return 'hub'
  return 'detail'
}

function getPlatformVisualArea(pathname: string) {
  return PLATFORM_VISUAL_AREAS.find(({ prefixes }) => (
    prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ))?.name || 'brand'
}

function getPlatformVisualMode(pathname: string) {
  const athletePrefixes = [
    '/mylab',
    '/player-development',
    '/level-up',
    '/players',
    '/profile',
    '/coach',
    '/coaches',
    '/resources',
  ]
  const strategyPrefixes = [
    '/compete',
    '/matchup',
    '/captain',
    '/teams',
    '/tournaments',
    '/rankings',
    '/league-coordinator',
    '/leagues',
    '/leagues-and-tournaments',
    '/clubs',
    '/manage',
    '/admin',
    '/explore',
  ]

  if (athletePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return 'athlete'
  }

  if (strategyPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return 'strategy'
  }

  return 'brand'
}

function getContextualAtmosphereVisual(visualArea: string): ContextualTennisVisualName | null {
  if (visualArea === 'explore') return 'explore'
  if (visualArea === 'captain') return 'captain'
  if (visualArea === 'league') return 'league'
  if (visualArea === 'club') return 'club'
  if (visualArea === 'manage') return 'manage'
  if (visualArea === 'resources') return 'resources'
  return null
}
