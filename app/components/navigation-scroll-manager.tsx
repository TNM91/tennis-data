'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationScrollManager() {
  const pathname = usePathname() || '/'
  const lastPathnameRef = useRef(pathname)
  const linkNavigationPendingRef = useRef(false)
  const initialRestoreCompletedRef = useRef(false)

  useEffect(() => {
    function handleLinkNavigation(event: MouseEvent) {
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.target === '_blank') return

      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin || destination.pathname === pathname) return

      linkNavigationPendingRef.current = true
    }

    document.addEventListener('click', handleLinkNavigation, true)
    return () => document.removeEventListener('click', handleLinkNavigation, true)
  }, [pathname])

  useEffect(() => {
    const routeChanged = lastPathnameRef.current !== pathname
    lastPathnameRef.current = pathname

    if (routeChanged && linkNavigationPendingRef.current && !window.location.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }

    linkNavigationPendingRef.current = false
  }, [pathname])

  useEffect(() => {
    const storageKey = `tenaceiq.shell.scroll.${pathname}`

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
      if (window.location.hash) return

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

    if (!initialRestoreCompletedRef.current) {
      initialRestoreCompletedRef.current = true
      restoreScrollPosition()
    }

    window.addEventListener('pagehide', persistScrollPosition)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', persistScrollPosition)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pathname])

  return null
}
