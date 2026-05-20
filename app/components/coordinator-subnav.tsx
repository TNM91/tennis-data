'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type CSSProperties } from 'react'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { COORDINATOR_NAV_ITEMS } from '@/lib/site-navigation'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const PRIMARY_COORDINATOR_HREFS = [
  '/league-coordinator',
  '/league-coordinator#league-setup-form',
  '/league-coordinator/results',
  '/league-coordinator/individual-results',
  '/explore/leagues',
]

const COORDINATOR_NAV_META: Record<string, { icon: TiqFeatureIconName; short: string; result: string }> = {
  '/league-coordinator': {
    icon: 'teamRankings',
    short: 'Season command',
    result: 'See setup, entries, readiness, and public league status.',
  },
  '/league-coordinator#league-setup-form': {
    icon: 'schedule',
    short: 'League structure',
    result: 'Define format, dates, visibility, scoring, and participants.',
  },
  '/league-coordinator/results': {
    icon: 'reports',
    short: 'Team scorebook',
    result: 'Record team matches and line scores without spreadsheet cleanup.',
  },
  '/league-coordinator/individual-results': {
    icon: 'playerRatings',
    short: 'Player scorebook',
    result: 'Log ladder, round robin, and challenge results cleanly.',
  },
  '/data-assist': {
    icon: 'reports',
    short: 'Data intake',
    result: 'Bring schedules, rosters, and result files into TIQ.',
  },
  '/compete/leagues': {
    icon: 'accountSecurity',
    short: 'Member view',
    result: 'Check leagues tied to the signed-in player or team.',
  },
  '/explore/leagues': {
    icon: 'opponentScouting',
    short: 'Public league page',
    result: 'Show members where the season stands and what is next.',
  },
  '/pricing#league': {
    icon: 'captainDashboard',
    short: 'League unlock',
    result: 'Review the tier that turns league operations into a managed workflow.',
  },
}

function stripHash(href: string) {
  return href.split('#')[0] || href
}

function isActiveCoordinatorLink(pathname: string, href: string) {
  const routeHref = stripHash(href)
  if (href.includes('#')) return pathname === routeHref
  if (routeHref === '/league-coordinator') return pathname === routeHref
  if (pathname === routeHref) return true
  return routeHref !== '/' && pathname.startsWith(routeHref)
}

export default function CoordinatorSubnav({
  title = 'League command path',
  description = 'Work left to right: set up the season, approve the field, publish the path, record results, and give members one clear place to follow along.',
  tierLabel,
  tierActive,
}: {
  title?: string
  description?: string
  tierLabel?: string
  tierActive?: boolean
}) {
  const pathname = usePathname()
  const { isMobile } = useViewportBreakpoints()
  const primaryItems = COORDINATOR_NAV_ITEMS.filter((item) => PRIMARY_COORDINATOR_HREFS.includes(item.href))
  const secondaryItems = COORDINATOR_NAV_ITEMS.filter((item) => !PRIMARY_COORDINATOR_HREFS.includes(item.href))

  return (
    <section style={shellStyle} aria-label="League tools">
      <div style={meshStyle} aria-hidden="true" />
      <div
        style={{
          ...headerStyle,
          gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : headerStyle.gridTemplateColumns,
        }}
      >
        <div style={headerCopyStyle}>
          <div style={titleStyle}>{title}</div>
          <div style={descriptionStyle}>{description}</div>
        </div>
        <div style={headerStatusStyle}>
          <TiqFeatureIcon name="teamRankings" size="md" variant="surface" />
          <div style={statusCopyStyle}>
            <span style={statusLabelStyle}>Best use</span>
            <strong style={statusValueStyle}>One league-season flow</strong>
          </div>
          {tierLabel ? (
            <span style={tierActive ? tierPillGreen : tierPillSlate}>{tierLabel}</span>
          ) : null}
        </div>
      </div>

      <nav aria-label="League workflow" style={gridStyle}>
        {primaryItems.map((item, index) => {
          const active = isActiveCoordinatorLink(pathname, item.href)
          const meta = COORDINATOR_NAV_META[item.href]
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
              <TiqFeatureIcon name={meta?.icon ?? 'teamRankings'} size="sm" variant={active ? 'surface' : 'ghost'} />
              <span style={linkCopyStyle}>
                <span style={linkLabelStyle}>{item.label}</span>
                <span style={linkMetaStyle}>{meta?.short ?? 'League tool'}</span>
              </span>
              <span aria-hidden="true" style={linkArrowStyle}>{active ? 'Here' : 'Open'}</span>
            </Link>
          )
        })}
      </nav>

      {secondaryItems.length ? (
        <details style={moreToolsStyle}>
          <summary style={moreToolsSummaryStyle}>More league tools</summary>
          <nav aria-label="More league tools" style={secondaryGridStyle}>
            {secondaryItems.map((item) => {
              const active = isActiveCoordinatorLink(pathname, item.href)
              const meta = COORDINATOR_NAV_META[item.href]
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
                  <TiqFeatureIcon name={meta?.icon ?? 'teamRankings'} size="sm" variant={active ? 'surface' : 'ghost'} />
                  <span style={linkCopyStyle}>
                    <span style={linkLabelStyle}>{item.label}</span>
                    <span style={linkMetaStyle}>{meta?.result ?? 'Open the league tool.'}</span>
                  </span>
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
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gap: 16,
  padding: 18,
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(12,26,50,0.82) 0%, rgba(9,20,39,0.92) 100%)',
  boxShadow: '0 22px 54px rgba(2,10,24,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}

const meshStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'linear-gradient(var(--page-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--page-grid-line) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  opacity: 0.16,
  pointerEvents: 'none',
}

const headerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(min(100%, 320px), auto)',
  gap: 14,
  alignItems: 'start',
  minWidth: 0,
}

const headerCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const headerStatusStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '40px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
  minWidth: 0,
  padding: 12,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
}

const statusCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
}

const statusLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const statusValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
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
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const linkStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 28px) minmax(0, 34px) minmax(0, 1fr) minmax(0, auto)',
  alignItems: 'center',
  gap: 10,
  minHeight: 66,
  padding: '9px 12px',
  borderRadius: 16,
  textDecoration: 'none',
  color: 'var(--foreground)',
  border: '1px solid rgba(116,190,255,0.09)',
  background: 'rgba(255,255,255,0.035)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const stepStyle: CSSProperties = {
  width: 26,
  height: 26,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 950,
}

const activeLinkStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 34%, rgba(116,190,255,0.12) 66%)',
  background: 'color-mix(in srgb, rgba(255,255,255,0.045) 82%, var(--brand-green) 18%)',
  boxShadow: 'var(--shadow-soft)',
}

const linkCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
}

const linkLabelStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.1,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const linkMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.25,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const linkArrowStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  minWidth: 0,
}

const moreToolsStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minWidth: 0,
}

const moreToolsSummaryStyle: CSSProperties = {
  cursor: 'pointer',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const secondaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 10,
  marginTop: 12,
  minWidth: 0,
}

const secondaryLinkStyle: CSSProperties = {
  ...linkStyle,
  gridTemplateColumns: 'minmax(0, 34px) minmax(0, 1fr) minmax(0, auto)',
  minHeight: 58,
}

const tierPillBase: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'inline-flex',
  justifySelf: 'start',
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
