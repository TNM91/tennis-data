'use client'

import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { ADSENSE_PUBLISHER_ID, getConfiguredAdSlot, isAdSafePath } from '@/lib/adsense'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

export default function AdsenseSlot({
  slot,
  label = 'Advertisements',
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
  const adLabel = label === 'Sponsored Links' ? label : 'Advertisements'

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
    <section aria-label={adLabel} style={adShellStyle}>
      <script
        id="tenaceiq-adsense"
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
        crossOrigin="anonymous"
      />
      <div
        className="surface-card"
        style={adCardStyle}
      >
        <div style={adHeaderStyle}>
          <div style={adLabelStyle}>
            {adLabel}
          </div>
          <div style={adPlacementStyle}>
            TenAceIQ partner placement
          </div>
        </div>
        <div style={adCopyStyle}>
          Sponsored support keeps player tools and Team Hub accessible without getting in the way of match-week tools.
        </div>
        <ins
          className="adsbygoogle"
          style={{ display: 'block', minHeight }}
          data-ad-client={ADSENSE_PUBLISHER_ID}
          data-ad-slot={resolvedSlot || undefined}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </section>
  )
}

const adShellStyle: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '0 max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left))',
  minWidth: 0,
}

const adCardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.10)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, var(--brand-blue-2) 4%) 0%, color-mix(in srgb, var(--surface-soft) 98%, var(--foreground) 2%) 100%)',
  boxShadow: '0 16px 34px rgba(3, 10, 22, 0.10)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const adHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  marginBottom: 10,
  minWidth: 0,
}

const adLabelStyle: CSSProperties = {
  color: 'var(--muted-strong)',
  fontSize: '0.72rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const adPlacementStyle: CSSProperties = {
  color: 'var(--muted)',
  fontSize: '0.76rem',
  fontWeight: 700,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const adCopyStyle: CSSProperties = {
  color: 'var(--muted-strong)',
  fontSize: '0.9rem',
  lineHeight: 1.6,
  marginBottom: 14,
  minWidth: 0,
  overflowWrap: 'anywhere',
}
