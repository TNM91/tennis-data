'use client'

import Link from 'next/link'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/matchup', label: 'Matchups' },
  { href: '/captain', label: 'Captain' },
]

export default function SiteHeader({ active }: { active?: string }) {
  return (
    <header style={{ padding: '20px 18px 0' }}>
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderRadius: 22,
          background: 'rgba(8,26,49,0.72)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <Link href="/" style={{ fontWeight: 900, color: '#fff', textDecoration: 'none' }}>
          TenAce<span style={{ color: '#9be11d' }}>IQ</span>
        </Link>

        <nav style={{ display: 'flex', gap: 10 }}>
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
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}