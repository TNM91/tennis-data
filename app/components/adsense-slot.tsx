'use client'

import { useEffect, useMemo, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { getConfiguredAdSlot, isAdSafePath } from '@/lib/adsense'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

export default function AdsenseSlot({
  slot,
  label = 'Advertisement',
  minHeight = 280,
}: {
  slot?: string | null
  label?: string
  minHeight?: number
}) {
  const pathname = usePathname()
  const initializedRef = useRef(false)
  const resolvedSlot = useMemo(() => getConfiguredAdSlot(slot), [slot])
  const canRenderAd = Boolean(resolvedSlot) && isAdSafePath(pathname)

  useEffect(() => {
    if (!canRenderAd || initializedRef.current) return

    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      initializedRef.current = true
    } catch {
      initializedRef.current = false
    }
  }, [canRenderAd])

  if (!canRenderAd) return null

  return (
    <section
      aria-label={label}
      style={{
        width: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0 18px',
      }}
    >
      <div
        className="surface-card"
        style={{
          padding: 16,
          border: '1px solid rgba(116,190,255,0.10)',
          background: 'linear-gradient(180deg, rgba(14,28,53,0.72) 0%, rgba(8,16,30,0.94) 100%)',
        }}
      >
        <div
          style={{
            color: 'rgba(180,202,229,0.72)',
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          {label}
        </div>
        <ins
          className="adsbygoogle"
          style={{ display: 'block', minHeight }}
          data-ad-client="ca-pub-1351888380884789"
          data-ad-slot={resolvedSlot || undefined}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </section>
  )
}
