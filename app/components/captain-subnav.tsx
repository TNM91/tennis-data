'use client'

import Link from 'next/link'
import { CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { CAPTAIN_NAV_ITEMS, CAPTAIN_QUICK_NAV_ITEMS } from '@/lib/site-navigation'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const CAPTAIN_NAV_META: Record<string, { icon: TiqFeatureIconName; short: string; result: string }> = {
  '/captain/availability': {
    icon: 'reliabilityIndex',
    short: 'Roster signal',
    result: 'Know who is in, out, or needs a nudge.',
  },
  '/captain/lineup-builder': {
    icon: 'lineupBuilder',
    short: 'Lineup choice',
    result: 'Build the strongest practical court plan.',
  },
  '/captain/messaging': {
    icon: 'messagingCenter',
    short: 'Team handoff',
    result: 'Send one clean plan without retyping.',
  },
  '/captain/weekly-brief': {
    icon: 'captainDashboard',
    short: 'Captain read',
    result: 'See the week, risks, and next action.',
  },
  '/data-assist': {
    icon: 'reports',
    short: 'Data refresh',
    result: 'Bring scorecards, schedules, and rosters current.',
  },
  '/captain/scenario-builder': {
    icon: 'scenarioBuilder',
    short: 'Compare options',
    result: 'See which version has the cleanest edge.',
  },
  '/captain/lineup-projection': {
    icon: 'matchupAnalysis',
    short: 'Court projection',
    result: 'Preview where the swing courts may be.',
  },
  '/captain/lineup-availability': {
    icon: 'reliabilityIndex',
    short: 'Match status',
    result: 'Tie availability directly to match planning.',
  },
  '/captain/analytics': {
    icon: 'playerRatings',
    short: 'Captain IQ',
    result: 'Find the signal behind team choices.',
  },
  '/captain/team-brief': {
    icon: 'reports',
    short: 'Team brief',
    result: 'Turn context into a fast team read.',
  },
}

export default function CaptainSubnav({
  title = 'Team week command path',
  description = 'Work left to right: confirm availability, build the lineup, send the plan, read the brief, and refresh data when the week changes.',
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
  const secondaryItems = CAPTAIN_NAV_ITEMS.filter(
    (item) => !CAPTAIN_QUICK_NAV_ITEMS.some((quickItem) => quickItem.href === item.href),
  )

  return (
    <section style={shellStyle} aria-label="Captain tools">
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
          <TiqFeatureIcon name="captainDashboard" size="md" variant="surface" />
          <div style={statusCopyStyle}>
            <span style={statusLabelStyle}>Best use</span>
            <strong style={statusValueStyle}>One match-week flow</strong>
          </div>
          {tierLabel ? (
            <span style={tierActive ? tierPillGreen : tierPillSlate}>{tierLabel}</span>
          ) : null}
        </div>
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
              <TiqFeatureIcon name={CAPTAIN_NAV_META[item.href]?.icon ?? 'captainDashboard'} size="sm" variant={active ? 'surface' : 'ghost'} />
              <span style={linkCopyStyle}>
                <span style={linkLabelStyle}>{item.label}</span>
                <span style={linkMetaStyle}>{CAPTAIN_NAV_META[item.href]?.short ?? 'Captain tool'}</span>
              </span>
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
                  <TiqFeatureIcon name={CAPTAIN_NAV_META[item.href]?.icon ?? 'captainDashboard'} size="sm" variant={active ? 'surface' : 'ghost'} />
                  <span style={linkCopyStyle}>
                    <span style={linkLabelStyle}>{item.label}</span>
                    <span style={linkMetaStyle}>{CAPTAIN_NAV_META[item.href]?.result ?? 'Open the captain tool.'}</span>
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
}

const meshStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'transparent',
  opacity: 0,
  pointerEvents: 'none',
}

const headerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(min(100%, 310px), auto)',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
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
}

const descriptionStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
}

const gridStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const linkStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 30px) minmax(0, 34px) minmax(0, 1fr) minmax(0, auto)',
  alignItems: 'center',
  gap: 10,
  minHeight: 66,
  padding: '10px 12px',
  borderRadius: 16,
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
  background: 'var(--shell-chip-bg-strong)',
  boxShadow: 'var(--shadow-soft)',
}

const linkLabelStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.15,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  minWidth: 0,
}

const linkCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
}

const linkMetaStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.25,
  fontWeight: 750,
}

const linkArrowStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
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
  gridColumn: '1 / -1',
  width: 'fit-content',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 82%, var(--brand-green) 18%)',
  color: 'color-mix(in srgb, var(--brand-green) 76%, var(--foreground-strong) 24%)',
}

const tierPillSlate: CSSProperties = {
  ...tierPillBase,
  gridColumn: '1 / -1',
  width: 'fit-content',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
}

const moreToolsStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  marginTop: 12,
  minWidth: 0,
}

const secondaryLinkStyle: CSSProperties = {
  ...linkStyle,
  gridTemplateColumns: 'minmax(0, 34px) minmax(0, 1fr) minmax(0, auto)',
  minHeight: 58,
}
