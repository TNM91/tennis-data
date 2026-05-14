'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type CSSProperties } from 'react'
import { COORDINATOR_NAV_ITEMS } from '@/lib/site-navigation'

function stripHash(href: string) {
  return href.split('#')[0] || href
}

function isActiveCoordinatorLink(pathname: string, href: string) {
  const routeHref = stripHash(href)
  if (href.includes('#')) return false
  if (routeHref === '/league-coordinator') return pathname === routeHref
  if (pathname === routeHref) return true
  return routeHref !== '/' && pathname.startsWith(routeHref)
}

export default function CoordinatorSubnav({
  title = 'League Coordinator',
  description = 'Set up seasons, manage participants, and move results into the league record.',
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
    <section style={shellStyle} aria-label="League coordinator tools">
      <div style={headerStyle}>
        <div style={eyebrowStyle} aria-hidden="true">Coordinator path</div>
        <div style={titleStyle}>{title}</div>
        <div style={descriptionStyle}>{description}</div>
        {tierLabel ? (
          <div style={tierRowStyle}>
            <span style={tierActive ? tierPillGreen : tierPillSlate}>{tierLabel}</span>
          </div>
        ) : null}
      </div>

      <nav aria-label="League coordinator workflow" style={gridStyle}>
        {COORDINATOR_NAV_ITEMS.map((item, index) => {
          const active = isActiveCoordinatorLink(pathname, item.href)
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
              <span style={stepStyle}>{index + 1}</span>
              <span style={linkLabelStyle}>{item.label}</span>
              <span aria-hidden="true" style={linkArrowStyle}>{active ? 'Here' : 'Open'}</span>
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
}

const headerStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  maxWidth: 760,
  minWidth: 0,
}

const eyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 28,
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const descriptionStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
  overflowWrap: 'anywhere',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const linkStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.875rem) minmax(0, 1fr) minmax(0, 3.5rem)',
  alignItems: 'center',
  gap: 12,
  minHeight: 56,
  padding: '0 14px',
  borderRadius: 18,
  textDecoration: 'none',
  color: 'var(--foreground)',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  boxShadow: 'var(--home-control-shadow)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const stepStyle: CSSProperties = {
  width: 30,
  height: 30,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 18%, var(--shell-chip-bg) 82%)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
}

const activeLinkStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 86%, var(--brand-green) 14%)',
  boxShadow: 'var(--shadow-soft)',
}

const linkLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const linkArrowStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  minWidth: 0,
  overflowWrap: 'anywhere',
  textAlign: 'right',
}

const tierRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 4,
  minWidth: 0,
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
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const tierPillGreen: CSSProperties = {
  ...tierPillBase,
  background: 'color-mix(in srgb, var(--shell-chip-bg) 82%, var(--brand-green) 18%)',
  color: 'color-mix(in srgb, var(--brand-green) 76%, var(--foreground-strong) 24%)',
}

const tierPillSlate: CSSProperties = {
  ...tierPillBase,
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
}
