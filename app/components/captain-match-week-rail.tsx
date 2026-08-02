'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { buildCaptainScopedHref } from '@/lib/captain-memory'

type MatchWeekStep = 'availability' | 'lineup' | 'messaging'

type MatchWeekScope = {
  competitionLayer?: string
  team?: string
  league?: string
  flight?: string
  date?: string
  opponent?: string
}

const steps: Array<{ id: MatchWeekStep; label: string; path: string }> = [
  { id: 'availability', label: 'Confirm availability', path: '/captain/availability' },
  { id: 'lineup', label: 'Build projected lineup', path: '/captain/lineup-builder' },
  { id: 'messaging', label: 'Message team', path: '/captain/messaging' },
]

export default function CaptainMatchWeekRail({
  current,
  scope,
}: {
  current: MatchWeekStep
  scope: MatchWeekScope
}) {
  const currentIndex = steps.findIndex((step) => step.id === current)
  const hasMatch = Boolean(scope.date || scope.opponent)

  if (!hasMatch) {
    const returnTo = buildCaptainScopedHref(`/captain/${current === 'lineup' ? 'lineup-builder' : current}`, scope)
    const scheduleHref = `/data-assist?intent=upload-source&context=Team%20Hub&type=schedule&help=1&returnTo=${encodeURIComponent(returnTo)}#upload`

    return (
      <section style={railShell} aria-label="Match week setup">
        <div>
          <div style={kicker}>Match week</div>
          <strong style={title}>Add the schedule to choose the next match.</strong>
        </div>
        <Link href={scheduleHref} style={scheduleLink}>Add schedule</Link>
      </section>
    )
  }

  return (
    <section style={railShell} aria-label="Match week progress">
      <div style={matchContext}>
        <div style={kicker}>Match week</div>
        <strong style={title}>
          {scope.opponent ? `vs ${scope.opponent}` : 'Selected match'}
          {scope.date ? <span style={dateText}> - {formatMatchDate(scope.date)}</span> : null}
        </strong>
      </div>
      <nav style={stepList} aria-label="Match week steps">
        {steps.map((step, index) => {
          const isCurrent = step.id === current
          const isComplete = index < currentIndex
          const href = buildCaptainScopedHref(step.path, scope)
          return (
            <Link
              key={step.id}
              href={href}
              aria-current={isCurrent ? 'step' : undefined}
              style={{
                ...stepLink,
                ...(isCurrent ? activeStep : {}),
                ...(isComplete ? completeStep : {}),
              }}
            >
              <span aria-hidden="true" style={stepNumber}>{isComplete ? 'Done' : index + 1}</span>
              <span>{step.label}</span>
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

const matchContext: CSSProperties = { minWidth: 180 }
const kicker: CSSProperties = { color: '#93c5fd', fontSize: 11, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }
const title: CSSProperties = { display: 'block', marginTop: 3, color: 'var(--foreground-strong)', fontSize: 15 }
const dateText: CSSProperties = { color: 'var(--shell-copy-muted)', fontWeight: 700 }
const stepList: CSSProperties = { display: 'flex', gap: 7, flexWrap: 'wrap' }
const stepLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 38, padding: '7px 11px', borderRadius: 12, border: '1px solid var(--shell-panel-border)', color: 'var(--shell-copy-muted)', background: 'var(--shell-chip-bg)', fontSize: 12, fontWeight: 800, textDecoration: 'none' }
const activeStep: CSSProperties = { color: 'var(--foreground-strong)', borderColor: 'color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)', background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-chip-bg) 86%)' }
const completeStep: CSSProperties = { color: 'var(--brand-lime)' }
const stepNumber: CSSProperties = { display: 'grid', placeItems: 'center', minWidth: 20, height: 20, padding: '0 4px', borderRadius: 999, border: '1px solid currentColor', fontSize: 10 }
const scheduleLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '8px 15px', borderRadius: 999, background: 'var(--brand-green)', color: '#071107', fontWeight: 900, textDecoration: 'none' }
