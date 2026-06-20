'use client'

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="en" data-theme="dark">
      <body
        style={{
          margin: 0,
          background: 'linear-gradient(180deg, #0b1830 0%, #102347 50%, #0c1a33 100%)',
          color: 'var(--foreground)',
          fontFamily: '"Manrope", "Segoe UI", system-ui, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 460,
            width: 'calc(100% - clamp(24px, 6vw, 48px))',
            padding: '40px 36px',
            borderRadius: 28,
            border: '1px solid rgba(116,190,255,0.18)',
            background: 'linear-gradient(180deg, rgba(19,40,76,0.78) 0%, rgba(10,24,47,0.96) 100%)',
            boxShadow: '0 26px 80px rgba(7,18,42,0.36)',
            textAlign: 'center',
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          <div style={{ margin: '0 auto 16px', width: 54, height: 54, borderRadius: 18, display: 'grid', placeItems: 'center', border: '1px solid color-mix(in srgb, var(--brand-green) 24%, rgba(116,190,255,0.18) 76%)', background: 'color-mix(in srgb, var(--brand-green) 10%, transparent 90%)', color: 'var(--foreground-strong)', fontSize: 24, fontWeight: 900 }}>
            TIQ
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground-strong)', lineHeight: 1.2 }}>
            TenAceIQ needs a quick reset
          </h1>
          <p style={{ marginTop: 14, color: 'var(--shell-copy-muted)', lineHeight: 1.65, fontSize: '0.97rem' }}>
            A critical view failed to load. Try again to reopen TenAceIQ.
          </p>
          <button
            onClick={unstable_retry}
            style={{
              marginTop: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 48,
              padding: '0 28px',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: '0.97rem',
              cursor: 'pointer',
              border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
              background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
              color: 'var(--foreground-strong)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
