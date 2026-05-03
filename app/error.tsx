'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div
        className="surface-card"
        style={{ padding: '36px 32px', maxWidth: 460, width: '100%', textAlign: 'center' }}
      >
        <div style={{ fontSize: '2.4rem', marginBottom: 12 }}>⚠️</div>
        <h2 style={{ margin: 0, color: 'var(--foreground-strong)', fontSize: '1.35rem', fontWeight: 800 }}>
          Something went wrong
        </h2>
        <p style={{ marginTop: 12, color: 'var(--muted-strong)', fontSize: '0.95rem', lineHeight: 1.65, marginBottom: 0 }}>
          An unexpected error occurred. You can try again or return to the homepage.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 28, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="button-primary" onClick={unstable_retry} style={{ minWidth: 130, fontSize: '0.95rem' }}>
            Try again
          </button>
          <Link href="/" className="button-ghost" style={{ minWidth: 130, fontSize: '0.95rem' }}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
