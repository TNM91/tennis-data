import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 — Page Not Found',
  robots: { index: false },
}

export default function NotFound() {
  return (
    <div
      className="page-shell"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <p
          style={{
            margin: '0 0 16px',
            fontSize: '5rem',
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.06em',
            color: 'var(--foreground-strong)',
            opacity: 0.18,
          }}
        >
          404
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
            fontWeight: 850,
            letterSpacing: '-0.04em',
            color: 'var(--foreground-strong)',
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            marginTop: 14,
            color: 'var(--muted-strong)',
            fontSize: '1rem',
            lineHeight: 1.65,
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" className="button-primary" style={{ minWidth: 140, fontSize: '0.95rem' }}>
            Go home
          </Link>
          <Link href="/explore/players" className="button-ghost" style={{ minWidth: 140, fontSize: '0.95rem' }}>
            Explore players
          </Link>
        </div>
      </div>
    </div>
  )
}
