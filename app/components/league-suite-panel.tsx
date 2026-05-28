'use client'

import type { CSSProperties } from 'react'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type LeagueSuiteStep = 'shared-calendar' | 'team-book' | 'player-book' | 'team-results' | 'player-results'

type LeagueSuiteConfig = {
  label: string
  title: string
  body: string
  href: string
  icon: TiqFeatureIconName
}

const SUITE_STEPS: Record<LeagueSuiteStep, LeagueSuiteConfig> = {
  'shared-calendar': {
    label: 'Shared calendar',
    title: 'Shared calendar',
    body: 'Publish, propose, confirm, and track match dates for everyone in the league.',
    href: '/compete/schedule',
    icon: 'schedule',
  },
  'team-book': {
    label: 'Team book',
    title: 'Team book',
    body: 'Enter match events and line scores so standings can move without spreadsheet cleanup.',
    href: '/league-coordinator/results',
    icon: 'reports',
  },
  'player-book': {
    label: 'Player book',
    title: 'Player book',
    body: 'Capture one-on-one results for ladders, round robins, and challenge leagues.',
    href: '/league-coordinator/individual-results',
    icon: 'playerRatings',
  },
  'team-results': {
    label: 'Team book',
    title: 'Team book',
    body: 'Enter match events and line scores so standings can move without spreadsheet cleanup.',
    href: '/league-coordinator/results',
    icon: 'reports',
  },
  'player-results': {
    label: 'Player book',
    title: 'Player book',
    body: 'Capture one-on-one results for ladders, round robins, and challenge leagues.',
    href: '/league-coordinator/individual-results',
    icon: 'playerRatings',
  },
}

export default function LeagueSuitePanel({
  active,
  leagueLabel,
}: {
  active: LeagueSuiteStep
  leagueLabel?: string
  flow?: LeagueSuiteStep[]
}) {
  const { isMobile } = useViewportBreakpoints()
  const activeConfig = SUITE_STEPS[active]

  return (
    <section style={shellStyle} aria-label="League coordinator suite context">
      <div
        style={{
          ...headerStyle,
          gridTemplateColumns: isMobile ? '48px minmax(0, 1fr)' : headerStyle.gridTemplateColumns,
        }}
      >
        <TiqFeatureIcon name={activeConfig.icon} size="md" variant="surface" />
        <div style={headerCopyStyle}>
          <h2 style={titleStyle}>{activeConfig.title}</h2>
          <p style={bodyStyle}>{activeConfig.body}</p>
        </div>
        <div
          style={{
            ...scopePillStyle,
            ...(isMobile ? { gridColumn: '1 / -1', justifySelf: 'start' } : null),
          }}
        >
          {leagueLabel || 'League season'}
        </div>
      </div>

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
