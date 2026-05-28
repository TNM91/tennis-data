'use client'

import type { CSSProperties } from 'react'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type CaptainSuiteStep =
  | 'availability'
  | 'lineup'
  | 'scenario'
  | 'messaging'
  | 'brief'
  | 'projection'
  | 'analytics'
  | 'team-brief'

type SuiteStepConfig = {
  label: string
  title: string
  body: string
  href: string
  icon: TiqFeatureIconName
}

const SUITE_STEPS: Record<CaptainSuiteStep, SuiteStepConfig> = {
  availability: {
    label: 'Now',
    title: 'Confirm who can play',
    body: 'Start the week by turning unknown responses into a usable player pool.',
    href: '/captain/availability',
    icon: 'reliabilityIndex',
  },
  lineup: {
    label: 'Next',
    title: 'Build the lineup',
    body: 'Place available players, lock trusted courts, and save the version you can explain.',
    href: '/captain/lineup-builder',
    icon: 'lineupBuilder',
  },
  scenario: {
    label: 'Compare',
    title: 'Test versions',
    body: 'Put saved builds side by side and find the courts that actually swing the choice.',
    href: '/captain/scenario-builder',
    icon: 'scenarioBuilder',
  },
  messaging: {
    label: 'Send',
    title: 'Share the plan',
    body: 'Turn the decision into clear team communication without rebuilding the message.',
    href: '/captain/messaging',
    icon: 'messagingCenter',
  },
  brief: {
    label: 'Read',
    title: 'Use the weekly brief',
    body: 'See the match-week read, risks, and follow-up moves in one place.',
    href: '/captain/weekly-brief',
    icon: 'captainDashboard',
  },
  projection: {
    label: 'Check',
    title: 'Project courts',
    body: 'Preview where the matchup leans before a final lineup choice.',
    href: '/captain/lineup-projection',
    icon: 'matchupAnalysis',
  },
  analytics: {
    label: 'Learn',
    title: 'Review Captain IQ',
    body: 'Use team signals to understand what has been working and what needs attention.',
    href: '/captain/analytics',
    icon: 'playerRatings',
  },
  'team-brief': {
    label: 'Prep',
    title: 'Open team brief',
    body: 'Condense team context into a fast read before the next decision.',
    href: '/captain/team-brief',
    icon: 'reports',
  },
}

export default function CaptainSuitePanel({
  active,
  teamLabel,
}: {
  active: CaptainSuiteStep
  teamLabel?: string
  flow?: CaptainSuiteStep[]
}) {
  const { isMobile } = useViewportBreakpoints()
  const activeConfig = SUITE_STEPS[active]

  return (
    <section style={shellStyle} aria-label="Captain suite context">
      <div
        style={{
          ...headerStyle,
          gridTemplateColumns: isMobile ? '48px minmax(0, 1fr)' : headerStyle.gridTemplateColumns,
        }}
      >
        <div style={headerIconStyle}>
          <TiqFeatureIcon name={activeConfig.icon} size="md" variant="surface" />
        </div>
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
          {teamLabel || 'Team week'}
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

const headerIconStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
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
