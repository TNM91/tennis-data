'use client'

import Link from 'next/link'
import BrandWordmark from '@/app/components/brand-wordmark'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/matchup', label: 'Matchups' },
  { href: '/captain', label: 'Captain' },
]

export default function SiteHeader({ active }: { active?: string }) {
  return (
    <header style={{ padding: '20px 18px 0', position: 'relative', zIndex: 2 }}>
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 18px',
          borderRadius: 22,
          background: 'rgba(8,26,49,0.72)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(14px)',
          boxShadow: '0 14px 40px rgba(2, 10, 24, 0.18)',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
          aria-label="TenAceIQ home"
        >
          <BrandWordmark />
        </Link>

        <nav style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                padding: '10px 14px',
                borderRadius: 999,
                textDecoration: 'none',
                fontWeight: 700,
                background:
                  active === l.href
                    ? 'linear-gradient(135deg,#9be11d,#4ade80)'
                    : 'rgba(255,255,255,0.06)',
                color: active === l.href ? '#04121f' : '#fff',
                border:
                  active === l.href
                    ? '1px solid rgba(155,225,29,0.34)'
                    : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {l.label}
            </Link>
          ))}

          <Link
            href="/leagues"
            style={{
              padding: '10px 14px',
              borderRadius: 999,
              textDecoration: 'none',
              fontWeight: 700,
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            Leagues
          </Link>
        </nav>
      </div>
    </header>
  )
}