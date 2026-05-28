import Link from 'next/link'
import type { Metadata } from 'next'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'

export const metadata: Metadata = {
  title: '404 - Page Not Found',
  robots: { index: false },
}

const recoveryLinks: Array<{
  href: string
  label: string
  text: string
  icon: TiqFeatureIconName
}> = [
  { href: '/explore', label: 'Find', text: 'Search tennis context', icon: 'opponentScouting' },
  { href: '/mylab', label: 'You', text: 'Open My Lab', icon: 'myLab' },
  { href: '/captain', label: 'Team', text: 'Open Captain', icon: 'lineupBuilder' },
]

export default function NotFound() {
  return (
    <div
      className="page-shell"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', minWidth: 0 }}
    >
      <div style={{ textAlign: 'center', maxWidth: 680, width: '100%', minWidth: 0 }}>
        <p
          style={{
            margin: '0 0 16px',
            fontSize: '5rem',
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: 0,
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
            letterSpacing: 0,
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
          That tennis page moved, expired, or never made it into the draw.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10, marginTop: 24 }}>
          {recoveryLinks.map((item) => (
            <Link key={item.href} href={item.href} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', gap: 10, alignItems: 'center', padding: 12, borderRadius: 16, border: '1px solid rgba(116,190,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'var(--foreground)', textDecoration: 'none', textAlign: 'left' }}>
              <TiqFeatureIcon name={item.icon} size="sm" variant="ghost" />
              <span style={{ display: 'grid', gap: 3 }}>
                <strong style={{ color: 'var(--foreground-strong)' }}>{item.label}</strong>
                <small style={{ color: 'var(--shell-copy-muted)', fontWeight: 750 }}>{item.text}</small>
              </span>
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 32, justifyContent: 'center', flexWrap: 'wrap', minWidth: 0 }}>
          <Link href="/" className="button-primary" style={{ minWidth: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', fontSize: '0.95rem' }}>
            Go home
          </Link>
          <Link href="/explore/players" className="button-ghost" style={{ minWidth: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', fontSize: '0.95rem' }}>
            Explore players
          </Link>
        </div>
      </div>
    </div>
  )
}
