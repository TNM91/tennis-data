'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import SiteHeader from '@/app/components/site-header'
import SiteFooter from '@/app/components/site-footer'
import { AuthProvider, useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState, type ProductAccessState } from '@/lib/access-model'
import { pageBackground, orbOne, orbTwo, gridGlow, topBlueWash } from '@/lib/design-system'
import { getPlanSignupHref } from '@/lib/plan-intent'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type ShellMode = {
  id: 'find' | 'you' | 'team' | 'league'
  label: string
  intent: string
  href: string
  icon: TiqFeatureIconName
  locked: (access: ProductAccessState) => boolean
  requiredPlan: 'free' | 'player_plus' | 'captain' | 'league'
}

const SHELL_MODES: ShellMode[] = [
  {
    id: 'find',
    label: 'Find',
    intent: 'Public tennis map',
    href: '/explore',
    icon: 'opponentScouting',
    locked: () => false,
    requiredPlan: 'free',
  },
  {
    id: 'you',
    label: 'You',
    intent: 'My Lab and prep',
    href: '/mylab',
    icon: 'myLab',
    locked: (access) => !access.canUseAdvancedPlayerInsights,
    requiredPlan: 'player_plus',
  },
  {
    id: 'team',
    label: 'Team',
    intent: 'Captain decisions',
    href: '/captain',
    icon: 'lineupBuilder',
    locked: (access) => !access.canUseCaptainWorkflow,
    requiredPlan: 'captain',
  },
  {
    id: 'league',
    label: 'League',
    intent: 'League tools',
    href: '/league-coordinator',
    icon: 'teamRankings',
    locked: (access) => !access.canUseLeagueTools,
    requiredPlan: 'league',
  },
]

export default function SiteShell({ children, active }: { children: ReactNode; active?: string }) {
  return (
    <AuthProvider>
      <SiteShellContent active={active}>{children}</SiteShellContent>
    </AuthProvider>
  )
}

function SiteShellContent({ children, active }: { children: ReactNode; active?: string }) {
  return (
      <main
        style={{
          ...pageBackground,
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        }}
      >
        <div style={orbOne} />
        <div style={orbTwo} />
        <div style={gridGlow} />
        <div style={topBlueWash} />

        <SiteHeader active={active} />
        <PlatformModeBar />
        <div id="main-content" className="page-reveal">{children}</div>
        <SiteFooter />
      </main>
  )
}

function PlatformModeBar() {
  const pathname = usePathname()
  const { role, userId, entitlements, authResolved } = useAuth()
  const { isMobile } = useViewportBreakpoints()
  const authenticated = Boolean(userId) || role !== 'public'
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = buildProductAccessState(resolvedRole, entitlements)

  const activeMode =
    pathname.startsWith('/captain') ? 'team'
      : pathname.startsWith('/league-coordinator') ? 'league'
        : pathname.startsWith('/mylab') || pathname.startsWith('/matchup') || pathname.startsWith('/profile') ? 'you'
          : 'find'

  return (
    <div style={modeBarOuterStyle}>
      <nav
        aria-label="TenAceIQ work modes"
        style={{
          ...modeBarStyle,
          gridTemplateColumns: isMobile ? 'repeat(4, minmax(0, 1fr))' : modeBarStyle.gridTemplateColumns,
          gap: isMobile ? 6 : modeBarStyle.gap,
          padding: isMobile ? 6 : modeBarStyle.padding,
        }}
      >
        {SHELL_MODES.map((mode) => {
          const locked = mode.locked(access)
          const active = activeMode === mode.id
          const href = locked && authenticated ? getPlanSignupHref(mode.requiredPlan) : mode.href
          return (
            <Link
              key={mode.id}
              href={href}
              aria-current={active ? 'page' : undefined}
              style={{
                ...modePillStyle,
                ...(isMobile ? modePillMobileStyle : null),
                ...(active ? modePillActiveStyle : null),
                ...(locked ? modePillLockedStyle : null),
              }}
            >
              <TiqFeatureIcon name={mode.icon} size="sm" variant={active ? 'surface' : 'ghost'} />
              <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <strong style={modePillLabelStyle}>{mode.label}</strong>
                {isMobile ? null : <em style={modePillIntentStyle}>{locked ? 'Preview unlock' : mode.intent}</em>}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

const modeBarOuterStyle = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 32px)))',
  margin: '0 auto',
  minWidth: 0,
} as const

const modeBarStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 8,
  padding: 8,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'linear-gradient(180deg, rgba(9,18,35,0.58) 0%, rgba(8,18,34,0.72) 100%)',
  boxShadow: '0 14px 34px rgba(2,10,24,0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
  overflowX: 'auto',
  overscrollBehaviorX: 'contain',
  WebkitOverflowScrolling: 'touch',
  minWidth: 0,
} as const

const modePillStyle = {
  display: 'grid',
  gridTemplateColumns: '34px minmax(0, 1fr)',
  gap: 9,
  alignItems: 'center',
  minHeight: 52,
  minWidth: 0,
  padding: '8px 10px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.08)',
  background: 'rgba(255,255,255,0.035)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
} as const

const modePillMobileStyle = {
  gridTemplateColumns: 'minmax(0, 1fr)',
  justifyItems: 'center',
  gap: 5,
  minHeight: 58,
  padding: '7px 4px',
  textAlign: 'center',
} as const

const modePillActiveStyle = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 36%, var(--shell-panel-border) 64%)',
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--brand-green) 14%, rgba(255,255,255,0.06) 86%) 0%, rgba(255,255,255,0.05) 100%)',
} as const

const modePillLockedStyle = {
  opacity: 0.82,
} as const

const modePillLabelStyle = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1,
  fontWeight: 950,
  whiteSpace: 'nowrap',
} as const

const modePillIntentStyle = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.25,
  fontStyle: 'normal',
  fontWeight: 800,
} as const
