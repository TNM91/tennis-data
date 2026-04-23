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
        padding: '0 max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left))',
      }}
    >
      <div
        className="surface-card"
        style={{
          padding: 16,
          borderRadius: 22,
          border: '1px solid rgba(116,190,255,0.10)',
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, var(--brand-blue-2) 4%) 0%, color-mix(in srgb, var(--surface-soft) 98%, var(--foreground) 2%) 100%)',
          boxShadow: '0 16px 34px rgba(3, 10, 22, 0.10)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              color: 'var(--muted-strong)',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </div>
          <div
            style={{
              color: 'var(--muted)',
              fontSize: '0.76rem',
              fontWeight: 700,
            }}
          >
            TenAceIQ partner placement
          </div>
        </div>
        <div
          style={{
            color: 'var(--muted-strong)',
            fontSize: '0.9rem',
            lineHeight: 1.6,
            marginBottom: 14,
          }}
        >
          Sponsored support keeps player and captain tools accessible while preserving the clean match-week workflow.
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
