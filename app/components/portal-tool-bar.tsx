'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { CSSProperties } from 'react'
import NavLockIcon from '@/app/components/nav-lock-icon'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState } from '@/lib/access-model'
import { getPrimaryNavTarget } from '@/lib/primary-nav-access'
import { PRODUCT_MODE_LANGUAGE, PRODUCT_MOTTO, type ProductModeId } from '@/lib/product-story'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type PortalLane = {
  id: ProductModeId
  icon: TiqFeatureIconName
  paths: string[]
  links: Array<{ label: string; href: string }>
}

const portalLanes: PortalLane[] = [
  {
    id: 'find',
    icon: 'opponentScouting',
    paths: ['/explore', '/players', '/teams', '/rankings', '/leagues'],
    links: [
      { label: 'Players', href: '/explore/players' },
      { label: 'Teams', href: '/explore/teams' },
      { label: 'Leagues', href: '/explore/leagues' },
      { label: 'Rankings', href: '/explore/rankings' },
    ],
  },
  {
    id: 'you',
    icon: 'myLab',
    paths: ['/mylab', '/profile', '/messages', '/data-assist'],
    links: [
      { label: 'My Lab', href: '/mylab' },
      { label: 'Profile', href: '/profile' },
      { label: 'Messages', href: '/messages' },
      { label: 'Data Assist', href: '/data-assist' },
    ],
  },
  {
    id: 'prep',
    icon: 'matchupAnalysis',
    paths: ['/matchup', '/compete'],
    links: [
      { label: 'Matchup', href: '/matchup' },
      { label: 'Schedule', href: '/compete/schedule' },
      { label: 'Results', href: '/compete/results' },
      { label: 'Teams', href: '/compete/teams' },
    ],
  },
  {
    id: 'team',
    icon: 'lineupBuilder',
    paths: ['/captain'],
    links: [
      { label: 'Availability', href: '/captain/availability' },
      { label: 'Lineup', href: '/captain/lineup-builder' },
      { label: 'Message', href: '/captain/messaging' },
      { label: 'Brief', href: '/captain/weekly-brief' },
    ],
  },
  {
    id: 'league',
    icon: 'teamRankings',
    paths: ['/league-coordinator'],
    links: [
      { label: 'Command', href: '/league-coordinator' },
      { label: 'Team book', href: '/league-coordinator/results' },
      { label: 'Player book', href: '/league-coordinator/individual-results' },
      { label: 'Public pages', href: '/explore/leagues' },
    ],
  },
]

const hiddenPrefixes = ['/login', '/join', '/legal', '/reset-password', '/forgot-password']

function isLaneActive(pathname: string, lane: PortalLane) {
  return lane.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function getActiveLane(pathname: string) {
  return portalLanes.find((lane) => isLaneActive(pathname, lane)) ?? portalLanes[0]
}

function isPortalHidden(pathname: string) {
  return pathname === '/' || hiddenPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export default function PortalToolBar() {
  const pathname = usePathname() || '/'
  const { role, userId, entitlements, authResolved } = useAuth()
  const { isMobile, isTablet } = useViewportBreakpoints()

  if (isPortalHidden(pathname)) return null

  const authenticated = Boolean(userId) || role !== 'public'
  const accessPending = authenticated && (!authResolved || entitlements === null)
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = buildProductAccessState(resolvedRole, entitlements)
  const activeLane = getActiveLane(pathname)
  const laneDetail = PRODUCT_MODE_LANGUAGE[activeLane.id]

  return (
    <section
      aria-label="TenAceIQ workspace"
      style={{
        position: 'sticky',
        top: 'calc(max(0px, env(safe-area-inset-top)) + 72px)',
        zIndex: 32,
        width: '100%',
        boxSizing: 'border-box',
        padding: isMobile ? '0 8px 8px' : isTablet ? '0 12px 10px' : '0 16px 12px',
        overflow: 'clip',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 'min(1280px, 100%)',
          margin: '0 auto',
          border: '1px solid color-mix(in srgb, var(--shell-panel-border) 82%, rgba(155,225,29,0.16) 18%)',
          borderRadius: isMobile ? 18 : 22,
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--shell-panel-bg) 94%, rgba(155,225,29,0.08) 6%) 0%, color-mix(in srgb, var(--surface) 92%, rgba(37,119,242,0.10) 8%) 100%)',
          boxShadow: '0 18px 44px rgba(0, 8, 20, 0.20), inset 0 1px 0 rgba(255,255,255,0.04)',
          padding: isMobile ? 8 : 10,
          display: 'grid',
          gap: 8,
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? 'repeat(2, minmax(0, 1fr))'
              : 'repeat(5, minmax(0, 1fr))',
            gap: 8,
            minWidth: 0,
          }}
        >
          {portalLanes.map((lane) => {
            const mode = PRODUCT_MODE_LANGUAGE[lane.id]
            const active = lane.id === activeLane.id
            const target = accessPending
              ? { href: mode.route, locked: false, requiredPlan: null }
              : getPrimaryNavTarget(mode.route, access, authenticated)

            return (
              <Link
                key={lane.id}
                href={target.href}
                aria-current={active ? 'page' : undefined}
                title={target.locked ? `${mode.label} unlocks with ${mode.planId ? mode.planId.replace('_plus', '') : 'a plan'}` : mode.job}
                style={{
                  ...laneLinkStyle,
                  minHeight: isMobile ? 58 : 62,
                  borderColor: active ? 'rgba(155,225,29,0.55)' : 'var(--shell-panel-border)',
                  background: active
                    ? 'linear-gradient(135deg, rgba(155,225,29,0.16), rgba(37,119,242,0.08))'
                    : 'linear-gradient(180deg, color-mix(in srgb, var(--shell-chip-bg) 94%, transparent 6%), color-mix(in srgb, var(--surface) 86%, transparent 14%))',
                  boxShadow: active ? 'inset 0 0 0 1px rgba(155,225,29,0.08), 0 12px 28px rgba(0,0,0,0.14)' : 'none',
                }}
              >
                <span style={laneIconWrapStyle}>
                  {target.locked ? <NavLockIcon size={15} /> : <TiqFeatureIcon name={lane.icon} size="sm" variant={active ? 'surface' : 'ghost'} />}
                </span>
                <span style={laneTextStyle}>
                  <strong style={laneLabelStyle}>{mode.label}</strong>
                  <span style={laneJobStyle}>{mode.job}</span>
                </span>
              </Link>
            )
          })}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          <div style={portalMottoStyle}>{PRODUCT_MOTTO}</div>
          <nav
            aria-label={`${laneDetail.label} shortcuts`}
            style={{
              display: 'flex',
              justifyContent: isMobile ? 'stretch' : 'flex-end',
              gap: 7,
              flexWrap: 'wrap',
              flex: isMobile ? '1 1 100%' : '1 1 auto',
              minWidth: 0,
            }}
          >
            {activeLane.links.map((link) => {
              const current = pathname === link.href || pathname.startsWith(`${link.href}/`)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    ...quickLinkStyle,
                    flex: isMobile ? '1 1 calc(50% - 8px)' : undefined,
                    borderColor: current ? 'rgba(155,225,29,0.44)' : 'var(--shell-panel-border)',
                    color: current ? 'var(--foreground-strong)' : 'var(--shell-copy-muted)',
                    background: current ? 'rgba(155,225,29,0.12)' : 'rgba(255,255,255,0.025)',
                  }}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </section>
  )
}

const laneLinkStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  padding: '9px 11px',
  border: '1px solid var(--shell-panel-border)',
  borderRadius: 16,
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  overflow: 'hidden',
}

const laneIconWrapStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 36,
  minWidth: 36,
  height: 36,
  borderRadius: 12,
  background: 'color-mix(in srgb, var(--surface-soft) 72%, transparent 28%)',
}

const laneTextStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
}

const laneLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 950,
  lineHeight: 1.05,
  overflowWrap: 'anywhere',
}

const laneJobStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 800,
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const portalMottoStyle: CSSProperties = {
  color: 'color-mix(in srgb, var(--brand-green) 74%, var(--foreground-strong) 26%)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const quickLinkStyle: CSSProperties = {
  minHeight: 34,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 12px',
  border: '1px solid var(--shell-panel-border)',
  borderRadius: 999,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
  lineHeight: 1,
  textDecoration: 'none',
  minWidth: 0,
  overflowWrap: 'anywhere',
}
