'use client'

import { useEffect, useRef } from 'react'
import { readCaptainMobileResume, type CaptainMobileResume } from './captain-mobile-resume'

function disclosureKey(element: HTMLDetailsElement) {
  return element.id || element.querySelector('summary')?.textContent?.trim() || ''
}

export function useCaptainMobileResume({ storageKey, ready, data, onRestore }: {
  storageKey: string
  ready: boolean
  data: Record<string, unknown>
  onRestore: (data: Record<string, unknown>) => void
}) {
  const latest = useRef({ data, onRestore, storageKey, ready })
  const restoredKey = useRef('')
  const lastScroll = useRef(0)
  useEffect(() => { latest.current = { data, onRestore, storageKey, ready } }, [data, onRestore, storageKey, ready])

  useEffect(() => {
    if (!ready || !storageKey) return
    let frame = 0
    if (restoredKey.current !== storageKey) {
      restoredKey.current = storageKey
      let saved: CaptainMobileResume | null = null
      try { saved = readCaptainMobileResume(window.sessionStorage.getItem(storageKey)) } catch { /* Recovery is optional when storage is blocked. */ }
      if (saved) {
        latest.current.onRestore(saved.data)
        const snapshot = saved
        frame = window.requestAnimationFrame(() => {
          for (const element of document.querySelectorAll<HTMLDetailsElement>('main details')) {
            const disclosure = snapshot.disclosures.find((item) => item.key === disclosureKey(element))
            if (disclosure) element.open = disclosure.open
          }
          window.scrollTo({ top: snapshot.scrollY, behavior: 'instant' })
          lastScroll.current = snapshot.scrollY
        })
      } else lastScroll.current = window.scrollY
    }
    const save = () => {
      if (frame || latest.current.storageKey !== storageKey || !latest.current.ready) return
      const snapshot: CaptainMobileResume = {
        version: 1, savedAt: Date.now(), scrollY: lastScroll.current,
        disclosures: Array.from(document.querySelectorAll<HTMLDetailsElement>('main details'), (element) => ({ key: disclosureKey(element), open: element.open })),
        data: latest.current.data,
      }
      try { window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot)) } catch { /* Keep editing available without session storage. */ }
    }
    const rememberScroll = () => { lastScroll.current = window.scrollY }
    const onVisibility = () => { if (document.visibilityState === 'hidden') save() }
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('click', save, true)
    window.addEventListener('pagehide', save)
    window.addEventListener('scroll', rememberScroll, { passive: true })
    const timer = window.setInterval(save, 1000)
    const releaseFrame = window.requestAnimationFrame(() => { frame = 0 })
    return () => {
      window.cancelAnimationFrame(frame)
      window.cancelAnimationFrame(releaseFrame)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('click', save, true)
      window.removeEventListener('pagehide', save)
      window.removeEventListener('scroll', rememberScroll)
    }
  }, [ready, storageKey])
}
