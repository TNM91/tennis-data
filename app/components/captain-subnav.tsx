'use client'

import Link from 'next/link'
import { CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { CAPTAIN_NAV_ITEMS } from '@/lib/site-navigation'

export default function CaptainSubnav({
  title = 'Captain tools',
  description = 'Move between the command-center tools without losing your current team scope.',
  tierLabel,
  tierActive,
}: {
  title?: string
  description?: string
  tierLabel?: string
  tierActive?: boolean
}) {
  const pathname = usePathname()

  return (
    <section style={shellStyle} aria-label="Captain tools">
      <div style={headerStyle}>
        <div style={eyebrowStyle} aria-hidden="true">Command center</div>
        <div style={titleStyle}>{title}</div>
        <div style={descriptionStyle}>{description}</div>
        {tierLabel ? (
          <div style={tierRowStyle}>
            <span style={tierActive ? tierPillGreen : tierPillSlate}>{tierLabel}</span>
          </div>
        ) : null}
      </div>

      <nav aria-label="Captain navigation" style={gridStyle}>
        {CAPTAIN_NAV_ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              style={{
                ...linkStyle,
                ...(active ? activeLinkStyle : null),
              }}
            >
              <span style={linkLabelStyle}>{item.label}</span>
              <span aria-hidden="true" style={linkArrowStyle}>{active ? 'Live' : 'Open'}</span>
            </Link>
          )
        })}
      </nav>
    </section>
  )
}

const shellStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 20,
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(18,36,66,0.68) 0%, rgba(17,34,61,0.54) 100%)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.16)',
}

const headerStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  maxWidth: 720,
}

const eyebrowStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: 28,
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const descriptionStyle: CSSProperties = {
  color: 'rgba(229,238,251,0.76)',
  fontSize: 14,
  lineHeight: 1.65,
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 12,
}

const linkStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minHeight: 56,
  padding: '0 16px',
  borderRadius: 18,
  textDecoration: 'none',
  color: '#eaf4ff',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
}

const activeLinkStyle: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'linear-gradient(180deg, rgba(155,225,29,0.08) 0%, rgba(18,34,62,0.88) 100%)',
  boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
}

const linkLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
}

const linkArrowStyle: CSSProperties = {
  color: 'rgba(215,229,247,0.74)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const tierRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 4,
}

const tierPillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const tierPillGreen: CSSProperties = {
  ...tierPillBase,
  background: 'rgba(155,225,29,0.14)',
  color: '#e7ffd1',
}

const tierPillSlate: CSSProperties = {
  ...tierPillBase,
  background: 'rgba(142,161,189,0.14)',
  color: '#dfe8f8',
}
