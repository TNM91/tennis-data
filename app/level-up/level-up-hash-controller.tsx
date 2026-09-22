'use client'

import { useEffect, type MouseEvent, type ReactNode } from 'react'

function openHashDisclosure(hashValue = window.location.hash) {
  const hash = hashValue.replace(/^#/, '')
  if (!hash) return false

  const target = document.getElementById(decodeURIComponent(hash))
  if (!target) return false

  const disclosure = target instanceof HTMLDetailsElement ? target : target.closest('details')
  if (!(disclosure instanceof HTMLDetailsElement)) return false

  disclosure.open = true
  window.requestAnimationFrame(() => {
    disclosure.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
    disclosure.querySelector<HTMLElement>(':scope > summary')?.focus({ preventScroll: true })
  })
  return true
}

export default function LevelUpHashController() {
  useEffect(() => {
    let observer: MutationObserver | null = null

    function openCurrentHash() {
      if (openHashDisclosure() || !window.location.hash || observer) return

      observer = new MutationObserver(() => {
        if (!openHashDisclosure()) return
        observer?.disconnect()
        observer = null
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }

    openCurrentHash()
    window.addEventListener('hashchange', openCurrentHash)
    return () => {
      window.removeEventListener('hashchange', openCurrentHash)
      observer?.disconnect()
    }
  }, [])

  return null
}

export function LevelUpDisclosureLink({
  targetId,
  className,
  children,
}: {
  targetId: string
  className?: string
  children: ReactNode
}) {
  function openDisclosure(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    const nextHash = `#${targetId}`
    if (window.location.hash !== nextHash) window.history.pushState(null, '', nextHash)
    openHashDisclosure(nextHash)
  }

  return (
    <a className={className} href={`#${targetId}`} onClick={openDisclosure}>
      {children}
    </a>
  )
}
