'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { MEMBERSHIP_TIERS } from '@/lib/product-story'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

export type PlayerSuiteStep = 'connect' | 'lab' | 'matchup' | 'follow' | 'refresh'

type PlayerSuiteConfig = {
  label: string
  title: string
  body: string
  href: string
  icon: TiqFeatureIconName
}

const PLAYER_TIER = MEMBERSHIP_TIERS.player_plus

const SUITE_STEPS: Record<PlayerSuiteStep, PlayerSuiteConfig> = {
  connect: {
    label: 'Connect',
    title: 'Link your player record',
    body: 'Make ratings, teams, match history, and follows feel personal from the first tap.',
    href: '/profile',
    icon: 'accountSecurity',
  },
  lab: {
    label: 'Read',
    title: 'Open My Lab',
    body: 'Review your scorecard, goals, recent matches, and the next move worth making.',
    href: '/mylab',
    icon: 'myLab',
  },
  matchup: {
    label: 'Compare',
    title: 'Prep the next matchup',
    body: 'Turn a player, opponent, or doubles court into a quick read before you play.',
    href: '/matchup',
    icon: 'matchupAnalysis',
  },
  follow: {
    label: 'Track',
    title: 'Follow what matters',
    body: 'Keep players, teams, and leagues close so the site remembers your tennis world.',
    href: '/mylab#player-tools',
    icon: 'opponentScouting',
  },
  refresh: {
    label: 'Trust',
    title: 'Improve the data',
    body: 'Flag missing context and keep the insights useful as results and schedules change.',
    href: '/data-assist',
    icon: 'reports',
  },
}

const DEFAULT_FLOW: PlayerSuiteStep[] = ['connect', 'lab', 'matchup', 'follow', 'refresh']

export default function PlayerSuitePanel({
  active,
  playerLabel,
  flow = DEFAULT_FLOW,
}: {
  active: PlayerSuiteStep
  playerLabel?: string
  flow?: PlayerSuiteStep[]
}) {
  const { isMobile } = useViewportBreakpoints()
  const activeConfig = SUITE_STEPS[active]
  const nextStep = flow.find((step) => step !== active && flow.indexOf(step) > flow.indexOf(active)) ?? flow.find((step) => step !== active)
  const nextConfig = nextStep ? SUITE_STEPS[nextStep] : null

  return (
    <section style={shellStyle} aria-label="Player suite context">
      <div
        style={{
          ...headerStyle,
          gridTemplateColumns: isMobile ? '48px minmax(0, 1fr)' : headerStyle.gridTemplateColumns,
        }}
      >
        <TiqFeatureIcon name={activeConfig.icon} size="md" variant="surface" />
        <div style={headerCopyStyle}>
          <div style={eyebrowStyle}>{PLAYER_TIER.name} suite</div>
          <h2 style={titleStyle}>{activeConfig.title}</h2>
          <p style={bodyStyle}>{activeConfig.body}</p>
        </div>
        <div
          style={{
            ...scopePillStyle,
            ...(isMobile ? { gridColumn: '1 / -1', justifySelf: 'start' } : null),
          }}
        >
          {playerLabel || PLAYER_TIER.shortPromise}
        </div>
      </div>

      <div style={stepGridStyle}>
        {flow.map((step, index) => {
          const config = SUITE_STEPS[step]
          const selected = step === active
          return (
            <Link
              key={step}
              href={config.href}
              aria-current={selected ? 'step' : undefined}
              style={{
                ...stepCardStyle,
                ...(selected ? stepCardActiveStyle : null),
              }}
            >
              <span style={stepNumberStyle}>{index + 1}</span>
              <TiqFeatureIcon name={config.icon} size="sm" variant={selected ? 'surface' : 'ghost'} />
              <span style={stepCopyStyle}>
                <span style={stepLabelStyle}>{config.label}</span>
                <strong style={stepTitleStyle}>{config.title}</strong>
              </span>
            </Link>
          )
        })}
      </div>

      {nextConfig ? (
        <div style={nextActionStyle}>
          <span style={nextLabelStyle}>Suggested next move</span>
          <Link href={nextConfig.href} style={nextLinkStyle}>
            {nextConfig.title}
          </Link>
        </div>
      ) : null}
    </section>
  )
}

const shellStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 16,
  marginBottom: 22,
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(13,28,53,0.74) 0%, rgba(9,20,39,0.9) 100%)',
  boxShadow: '0 18px 46px rgba(2,10,24,0.14), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}

const headerStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px minmax(0, 1fr) minmax(0, auto)',
  gap: 12,
  alignItems: 'center',
  minWidth: 0,
}

const headerCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const eyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.2rem, 2vw, 1.6rem)',
  lineHeight: 1.05,
  letterSpacing: 0,
}

const bodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
}

const scopePillStyle: CSSProperties = {
  justifySelf: 'end',
  maxWidth: '100%',
  minHeight: 32,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const stepGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 184px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const stepCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px 32px minmax(0, 1fr)',
  gap: 9,
  alignItems: 'center',
  minHeight: 58,
  padding: '9px 10px',
  borderRadius: 15,
  border: '1px solid rgba(116,190,255,0.09)',
  background: 'rgba(255,255,255,0.035)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  minWidth: 0,
}

const stepCardActiveStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 34%, rgba(116,190,255,0.12) 66%)',
  background: 'color-mix(in srgb, rgba(255,255,255,0.045) 82%, var(--brand-green) 18%)',
}

const stepNumberStyle: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 950,
}

const stepCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
}

const stepLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

const stepTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const nextActionStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  paddingTop: 2,
}

const nextLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 850,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
}

const nextLinkStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 13,
  fontWeight: 900,
  textDecoration: 'none',
}
