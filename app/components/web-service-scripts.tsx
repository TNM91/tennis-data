'use client'

import Script from 'next/script'
import {useEffect, useSyncExternalStore} from 'react'
import {usePathname} from 'next/navigation'
import {Analytics} from '@vercel/analytics/next'
import {SpeedInsights} from '@vercel/speed-insights/next'
import {ADSENSE_PUBLISHER_ID, isAdSafePath} from '@/lib/adsense'
import {nativeWebPrivacy, rememberNativeWebPrivacy} from '@/lib/native-web-privacy'

const privacyEvent = 'tenaceiq-native-web-privacy'
let privateDocument = false

function readPrivacy() {
  if (typeof window === 'undefined') return true
  if (privateDocument) return true
  try { return nativeWebPrivacy(window.location.search, window.sessionStorage) }
  catch { return true }
}

function rememberPrivacy() {
  try { privateDocument = rememberNativeWebPrivacy(window.location.search, window.sessionStorage) || privateDocument }
  catch { privateDocument = true }
}

function subscribe(listener: () => void) {
  rememberPrivacy()
  const refresh = () => { rememberPrivacy(); listener() }
  window.addEventListener(privacyEvent, refresh)
  window.addEventListener('popstate', refresh)
  window.addEventListener('storage', refresh)
  return () => {
    window.removeEventListener(privacyEvent, refresh)
    window.removeEventListener('popstate', refresh)
    window.removeEventListener('storage', refresh)
  }
}

const serverPrivacy = () => true

export default function WebServiceScripts({observabilityEnabled}: {observabilityEnabled: boolean}) {
  const pathname = usePathname()
  const privateVisit = useSyncExternalStore(subscribe, readPrivacy, serverPrivacy)
  useEffect(() => {
    rememberPrivacy()
    window.dispatchEvent(new Event(privacyEvent))
  }, [pathname])
  // No third-party script is emitted during SSR or before the native-visit check.
  if (privateVisit) return null
  return <>
    {observabilityEnabled ? <><Analytics /><SpeedInsights /></> : null}
    {isAdSafePath(pathname) ? <Script
      id="tenaceiq-advertising"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    /> : null}
  </>
}
