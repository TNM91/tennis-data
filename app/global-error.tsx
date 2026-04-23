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
          color: '#e5eefb',
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
            width: 'calc(100% - 48px)',
            padding: '40px 36px',
            borderRadius: 28,
            border: '1px solid rgba(116,190,255,0.18)',
            background: 'linear-gradient(180deg, rgba(19,40,76,0.78) 0%, rgba(10,24,47,0.96) 100%)',
            boxShadow: '0 26px 80px rgba(7,18,42,0.36)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2.8rem', marginBottom: 16 }}>⚠️</div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#f8fbff', lineHeight: 1.2 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: 14, color: '#c5d5ea', lineHeight: 1.65, fontSize: '0.97rem' }}>
            A critical error occurred. Please try again.
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
              border: '1px solid rgba(155,225,29,0.35)',
              background: 'linear-gradient(135deg, #9be11d, #c7f36b)',
              color: '#08111d',
              boxShadow: '0 10px 30px rgba(74,222,128,0.25)',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
