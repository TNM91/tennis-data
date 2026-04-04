'use client'

import Link from 'next/link'
import BrandWordmark from '@/app/components/brand-wordmark'

export default function SiteFooter() {
  return (
    <footer style={{ position: 'relative', zIndex: 2, padding: '12px 18px 20px' }}>
      <div
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          borderRadius: '22px',
          background: 'linear-gradient(180deg, rgba(21,42,80,0.54) 0%, rgba(12,24,46,0.88) 100%)',
          border: '1px solid rgba(116,190,255,0.22)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          padding: '16px 20px 14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: '100%',
            gap: 18,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              textDecoration: 'none',
              flexShrink: 0,
            }}
            aria-label="TenAceIQ home"
          >
            <BrandWordmark footer />
          </Link>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 14px' }}>
            <Link href="/explore" style={footerLink}>Explore</Link>
            <Link href="/players" style={footerLink}>Players</Link>
            <Link href="/rankings" style={footerLink}>Rankings</Link>
            <Link href="/matchup" style={footerLink}>Matchups</Link>
            <Link href="/leagues" style={footerLink}>Leagues</Link>
            <Link href="/captain" style={footerLink}>Captain</Link>
          </div>

          <div
            style={{
              color: 'rgba(197,213,234,0.72)',
              fontSize: 13,
              fontWeight: 600,
              marginLeft: 'auto',
            }}
          >
            © {new Date().getFullYear()} TenAceIQ
          </div>
        </div>
      </div>
    </footer>
  )
}

const footerLink = {
  color: 'rgba(215,229,247,0.8)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
} as const