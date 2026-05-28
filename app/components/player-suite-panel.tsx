'use client'

import type { CSSProperties } from 'react'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { MEMBERSHIP_TIERS } from '@/lib/product-story'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

export type PlayerSuiteStep = 'lab' | 'development' | 'refresh' | 'matchup' | 'messages'

type PlayerSuiteConfig = {
  label: string
  title: string
  body: string
  href: string
  icon: TiqFeatureIconName
}

const PLAYER_TIER = MEMBERSHIP_TIERS.player_plus

const SUITE_STEPS: Record<PlayerSuiteStep, PlayerSuiteConfig> = {
  lab: {
    label: 'Open My Lab',
    title: 'Open My Lab',
    body: 'Review your scorecard, goals, recent matches, and the next move worth making.',
    href: '/mylab',
    icon: 'myLab',
  },
  development: {
    label: 'Open development path',
    title: 'Player Development',
    body: 'Use branded workbook paths, coach planner sheets, and weekly check-ins to turn goals into court work.',
    href: '/player-development',
    icon: 'matchPrep',
  },
  refresh: {
    label: 'Improve data',
    title: 'Improve data',
    body: 'Upload, report, or refresh the tennis context behind your read.',
    href: '/data-assist',
    icon: 'reports',
  },
  matchup: {
    label: 'Prep matchup',
    title: 'Prep matchup',
    body: 'Turn a player, opponent, or doubles court into a quick read before you play.',
    href: '/matchup',
    icon: 'matchupAnalysis',
  },
  messages: {
    label: 'Review messages',
    title: 'Review messages',
    body: 'Keep tennis replies, scheduling threads, and alerts together.',
    href: '/messages',
    icon: 'messagingCenter',
  },
}

export default function PlayerSuitePanel({
  active,
  playerLabel,
}: {
  active: PlayerSuiteStep
  playerLabel?: string
  flow?: PlayerSuiteStep[]
}) {
  const { isMobile } = useViewportBreakpoints()
  const activeConfig = SUITE_STEPS[active]

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

    </section>
  )
}

const shellStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 16,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
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
