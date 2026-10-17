'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { buildCaptainScopedHref } from '@/lib/captain-memory'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import styles from './captain-match-week-rail.module.css'

type MatchWeekStep = 'availability' | 'lineup' | 'messaging'
type MatchWeekProgress = Partial<Record<MatchWeekStep, { complete: boolean; label: string }>>

type MatchWeekScope = {
  competitionLayer?: string
  team?: string
  league?: string
  flight?: string
  date?: string
  opponent?: string
}

const steps: Array<{ id: MatchWeekStep; label: string; path: string }> = [
  { id: 'lineup', label: 'Build lineup', path: '/captain/lineup-builder' },
  { id: 'availability', label: 'Confirm players', path: '/captain/availability' },
  { id: 'messaging', label: 'Send team update', path: '/captain/messaging' },
]

export default function CaptainMatchWeekRail({
  current,
  scope,
  progress,
}: {
  current: MatchWeekStep
  scope: MatchWeekScope
  progress?: MatchWeekProgress
}) {
  const { isMobile } = useViewportBreakpoints()
  const hasMatch = Boolean(scope.date || scope.opponent)

  if (!hasMatch) {
    const returnTo = buildCaptainScopedHref(`/captain/${current === 'lineup' ? 'lineup-builder' : current}`, scope)
    const scheduleHref = `/data-assist?intent=upload-source&context=Team%20Hub&type=schedule&help=1&returnTo=${encodeURIComponent(returnTo)}#upload`

    return (
      <section style={railShell} aria-label="Match week setup">
        <div>
          <div style={kicker}>Match week</div>
          <strong style={title}>{scope.team ? `Add ${scope.team}'s schedule to choose the next match.` : 'Add the schedule to choose the next match.'}</strong>
        </div>
        <Link href={scheduleHref} style={scheduleLink}>Add schedule</Link>
      </section>
    )
  }

  return (
    <section className={styles.rail} style={isMobile ? mobileRailShell : railShell} aria-label="Match week progress">
      <div className={styles.context} style={matchContext}>
        <div className={styles.kicker} style={kicker}>Match week</div>
        <strong style={title}>
          {scope.opponent ? `vs ${scope.opponent}` : 'Selected match'}
          {scope.date ? <span style={dateText}> - {formatMatchDate(scope.date)}</span> : null}
        </strong>
        {scope.team ? <>
          <span className={styles.desktopScope} style={teamText}>{scope.team}{scope.league ? ` · ${scope.league}` : ''}{scope.flight ? ` · ${scope.flight}` : ''}</span>
          <details className={styles.mobileScope}>
            <summary>Team details</summary>
            <p>{scope.team}{scope.league ? ` · ${scope.league}` : ''}{scope.flight ? ` · ${scope.flight}` : ''}</p>
          </details>
        </> : null}
      </div>
      <nav style={isMobile ? mobileStepList : stepList} aria-label="Match week steps">
        {steps.map((step, index) => {
          const isCurrent = step.id === current
          const isComplete = progress?.[step.id]?.complete === true
          const href = buildCaptainScopedHref(step.path, scope)
          return (
            <Link
              key={step.id}
              href={href}
              className={styles.step}
              aria-current={isCurrent ? 'step' : undefined}
              style={{
                ...stepLink,
                ...(isMobile ? mobileStepLink : {}),
                ...(isCurrent ? activeStep : {}),
                ...(isComplete ? completeStep : {}),
              }}
            >
              <span className={styles.number} aria-hidden="true" style={stepNumber}>{isComplete ? 'Done' : index + 1}</span>
              <span>{isMobile ? mobileStepLabel(step.id) : step.label}{progress?.[step.id] ? <small style={{ display: 'block', fontSize: 10, marginTop: 3 }}>{progress[step.id]?.label}</small> : null}</span>
            </Link>
          )
        })}
      </nav>
    </section>
  )
}

function formatMatchDate(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function mobileStepLabel(step: MatchWeekStep) {
  if (step === 'availability') return 'Confirm'
  if (step === 'lineup') return 'Lineup'
  return 'Send'
}

const railShell: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 14,
  flexWrap: 'wrap',
  padding: '14px 16px',
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-panel-bg-strong) 93%)',
}

const mobileRailShell: CSSProperties = {
  ...railShell,
  display: 'grid',
  gap: 12,
  padding: '14px',
  borderRadius: 20,
  background: 'linear-gradient(145deg, color-mix(in srgb, var(--brand-blue-2) 14%, var(--shell-panel-bg-strong) 86%), var(--shell-panel-bg))',
  boxShadow: '0 16px 34px rgba(2, 10, 24, 0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
}

const matchContext: CSSProperties = { minWidth: 0 }
const kicker: CSSProperties = { color: '#93c5fd', fontSize: 11, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }
const title: CSSProperties = { display: 'block', marginTop: 4, color: 'var(--foreground-strong)', fontSize: 16, lineHeight: 1.25, overflowWrap: 'anywhere' }
const dateText: CSSProperties = { color: 'var(--shell-copy-muted)', fontWeight: 700 }
const teamText: CSSProperties = { display: 'block', marginTop: 3, color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 700, overflowWrap: 'anywhere' }
const stepList: CSSProperties = { display: 'flex', gap: 7, flexWrap: 'wrap' }
const stepLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44, padding: '7px 11px', borderRadius: 12, border: '1px solid var(--shell-panel-border)', color: 'var(--shell-copy-muted)', background: 'var(--shell-chip-bg)', fontSize: 12, fontWeight: 800, textDecoration: 'none' }
const mobileStepList: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 7, minWidth: 0 }
const mobileStepLink: CSSProperties = { flexDirection: 'column', justifyContent: 'center', minWidth: 0, minHeight: 56, gap: 5, padding: '8px 5px', borderRadius: 14, fontSize: 10, lineHeight: 1.15, textAlign: 'center' }
const activeStep: CSSProperties = { color: 'var(--foreground-strong)', borderColor: 'color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)', background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-chip-bg) 86%)' }
const completeStep: CSSProperties = { color: 'var(--brand-lime)' }
const stepNumber: CSSProperties = { display: 'grid', placeItems: 'center', minWidth: 20, height: 20, padding: '0 4px', borderRadius: 999, border: '1px solid currentColor', fontSize: 10 }
const scheduleLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '8px 15px', borderRadius: 999, background: 'var(--brand-green)', color: '#071107', fontWeight: 900, textDecoration: 'none' }
