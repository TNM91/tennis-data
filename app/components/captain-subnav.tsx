'use client'

import Link from 'next/link'
import { CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { CAPTAIN_NAV_ITEMS, CAPTAIN_QUICK_NAV_ITEMS } from '@/lib/site-navigation'

export default function CaptainSubnav({
  title = 'Captain path',
  description = 'Start with the weekly actions captains repeat most. Open extra tools only when the week needs them.',
  tierLabel,
  tierActive,
}: {
  title?: string
  description?: string
  tierLabel?: string
  tierActive?: boolean
}) {
  const pathname = usePathname()
  const secondaryItems = CAPTAIN_NAV_ITEMS.filter(
    (item) => !CAPTAIN_QUICK_NAV_ITEMS.some((quickItem) => quickItem.href === item.href),
  )

  return (
    <section style={shellStyle} aria-label="Captain tools">
      <div style={headerStyle}>
        <div style={eyebrowStyle} aria-hidden="true">Weekly path</div>
        <div style={titleStyle}>{title}</div>
        <div style={descriptionStyle}>{description}</div>
        {tierLabel ? (
          <div style={tierRowStyle}>
            <span style={tierActive ? tierPillGreen : tierPillSlate}>{tierLabel}</span>
          </div>
        ) : null}
      </div>

      <nav aria-label="Captain weekly workflow" style={gridStyle}>
        {CAPTAIN_QUICK_NAV_ITEMS.map((item, index) => {
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
              <span style={stepStyle}>{index + 1}</span>
              <span style={linkLabelStyle}>{item.label}</span>
              <span aria-hidden="true" style={linkArrowStyle}>{active ? 'Here' : 'Open'}</span>
            </Link>
          )
        })}
      </nav>

      {secondaryItems.length ? (
        <details style={moreToolsStyle}>
          <summary style={moreToolsSummaryStyle}>More tools</summary>
          <nav aria-label="More captain tools" style={secondaryGridStyle}>
            {secondaryItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    ...secondaryLinkStyle,
                    ...(active ? activeLinkStyle : null),
                  }}
                >
                  <span style={linkLabelStyle}>{item.label}</span>
                  <span aria-hidden="true" style={linkArrowStyle}>{active ? 'Here' : 'Open'}</span>
                </Link>
              )
            })}
          </nav>
        </details>
      ) : null}
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
}

const headerStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  maxWidth: 720,
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
}

const descriptionStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(176px, 1fr))',
  gap: 12,
}

const linkStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '30px minmax(0, 1fr) auto',
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
}

const linkArrowStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
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
  background: 'color-mix(in srgb, var(--shell-chip-bg) 82%, var(--brand-green) 18%)',
  color: 'color-mix(in srgb, var(--brand-green) 76%, var(--foreground-strong) 24%)',
}

const tierPillSlate: CSSProperties = {
  ...tierPillBase,
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
}

const moreToolsStyle: CSSProperties = {
  borderTop: '1px solid var(--shell-panel-border)',
  paddingTop: 12,
}

const moreToolsSummaryStyle: CSSProperties = {
  cursor: 'pointer',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 900,
}

const secondaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
  marginTop: 12,
}

const secondaryLinkStyle: CSSProperties = {
  ...linkStyle,
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  minHeight: 48,
}
