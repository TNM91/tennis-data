'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import type { CaptainLaunchProgress } from '@/lib/captain-launch-progress'

type CaptainLaunchPathProps = {
  progress: CaptainLaunchProgress
  playerHref: string
  teamHref: string
  scheduleHref: string
  contactsHref: string
  outreachHref: string
  matchWeekHref: string
}

const stepCopy = {
  player: {
    label: 'Player ID',
    title: 'Claim your Player ID',
    detail: 'Keep Captain tied to the right player and teams.',
    action: 'Find my player',
  },
  team: {
    label: 'Team Summary',
    title: 'Import your team',
    detail: 'Bring in the roster, official ratings, and standings.',
    action: 'Upload Team Summary',
  },
  schedule: {
    label: 'Match Schedule',
    title: 'Add the season schedule',
    detail: 'Open the next match week with the right date and opponent.',
    action: 'Upload schedule',
  },
  contacts: {
    label: 'Player Roster',
    title: 'Add private team contacts',
    detail: 'Keep the phone and email details you need for match-week asks.',
    action: 'Upload Player Roster',
  },
  outreach: {
    label: 'Team invite',
    title: 'Invite players to connect',
    detail: 'Send the setup text so players can claim their ID and choose their own team link.',
    action: 'Prepare team text',
  },
} as const

export default function CaptainLaunchPath({
  progress,
  playerHref,
  teamHref,
  scheduleHref,
  contactsHref,
  outreachHref,
  matchWeekHref,
}: CaptainLaunchPathProps) {
  const hrefByStep = {
    player: playerHref,
    team: teamHref,
    schedule: scheduleHref,
    contacts: contactsHref,
    outreach: outreachHref,
  } as const

  if (progress.isComplete) {
    return (
      <section style={completePanelStyle} aria-label="Captain launch trophy">
        <TiqFeatureIcon name="competeTennis" size="md" variant="surface" title="Team launch trophy" />
        <div style={copyStyle}>
          <span style={eyebrowStyle}>Captain trophy earned</span>
          <h2 style={titleStyle}>Team launch complete</h2>
          <p style={bodyStyle}>Your team, schedule, contacts, and player outreach are ready for a cleaner match week.</p>
        </div>
        <Link href={matchWeekHref} style={completeActionStyle}>Open match week</Link>
        <details style={completeDetailsStyle}>
          <summary style={summaryStyle}>View launch checklist</summary>
          <LaunchSteps progress={progress} hrefByStep={hrefByStep} compact />
        </details>
      </section>
    )
  }

  return (
    <section style={panelStyle} aria-label="Captain launch checklist">
      <div style={headerStyle}>
        <div style={copyStyle}>
          <span style={eyebrowStyle}>First captain win</span>
          <h2 style={titleStyle}>Launch your team</h2>
          <p style={bodyStyle}>Five quick steps, then Captain has the context to run match week without the setup scramble.</p>
        </div>
        <span style={progressPillStyle}>{progress.completedCount}/{progress.totalCount} ready</span>
      </div>
      <LaunchSteps progress={progress} hrefByStep={hrefByStep} />
    </section>
  )
}

function LaunchSteps({
  progress,
  hrefByStep,
  compact = false,
}: {
  progress: CaptainLaunchProgress
  hrefByStep: Record<'player' | 'team' | 'schedule' | 'contacts' | 'outreach', string>
  compact?: boolean
}) {
  return (
    <ol style={{ ...stepsStyle, ...(compact ? compactStepsStyle : {}) }} aria-label="Captain launch progress">
      {progress.steps.map((step, index) => {
        const copy = stepCopy[step.id]
        const isNext = progress.nextStep === step.id
        return (
          <li key={step.id} style={{ ...stepStyle, ...(isNext ? nextStepStyle : {}), ...(step.complete ? completeStepStyle : {}) }}>
            <span style={stepNumberStyle} aria-hidden="true">{step.complete ? '✓' : index + 1}</span>
            <span style={stepCopyStyle}>
              <small style={stepLabelStyle}>{copy.label}</small>
              <strong style={stepTitleStyle}>{copy.title}</strong>
              {!compact ? <span style={stepDetailStyle}>{copy.detail}</span> : null}
            </span>
            {step.complete ? (
              <span style={doneStyle}>Ready</span>
            ) : isNext ? (
              <Link href={hrefByStep[step.id]} style={stepActionStyle}>{copy.action}</Link>
            ) : (
              <span style={laterStyle}>Up next</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

const panelBaseStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 'clamp(16px, 3vw, 22px)',
  borderRadius: 20,
  border: '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 10%, var(--shell-panel-bg-strong) 90%), var(--shell-panel-bg-strong))',
}
const panelStyle: CSSProperties = panelBaseStyle
const completePanelStyle: CSSProperties = {
  ...panelBaseStyle,
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  alignItems: 'center',
}
const headerStyle: CSSProperties = { display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }
const copyStyle: CSSProperties = { display: 'grid', gap: 5, minWidth: 0 }
const eyebrowStyle: CSSProperties = { color: 'var(--brand-green)', fontSize: 11, fontWeight: 900, letterSpacing: '.09em', textTransform: 'uppercase' }
const titleStyle: CSSProperties = { margin: 0, color: 'var(--foreground-strong)', fontSize: 'clamp(21px, 3vw, 27px)', lineHeight: 1.08 }
const bodyStyle: CSSProperties = { margin: 0, color: 'var(--shell-copy-muted)', fontSize: 14, lineHeight: 1.5 }
const progressPillStyle: CSSProperties = { flex: '0 0 auto', padding: '7px 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--brand-green) 16%, var(--shell-chip-bg) 84%)', border: '1px solid color-mix(in srgb, var(--brand-green) 32%, var(--shell-panel-border) 68%)', color: 'var(--foreground-strong)', fontSize: 12, fontWeight: 900 }
const stepsStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 10, margin: 0, padding: 0, listStyle: 'none', minWidth: 0 }
const compactStepsStyle: CSSProperties = { marginTop: 10 }
const stepStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr)', gap: 9, alignItems: 'start', minWidth: 0, padding: 12, borderRadius: 15, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)' }
const nextStepStyle: CSSProperties = { borderColor: 'color-mix(in srgb, var(--brand-blue) 55%, var(--shell-panel-border) 45%)', background: 'color-mix(in srgb, var(--brand-blue) 10%, var(--shell-chip-bg) 90%)' }
const completeStepStyle: CSSProperties = { background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)' }
const stepNumberStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 999, background: 'var(--shell-panel-bg-strong)', border: '1px solid var(--shell-panel-border)', color: 'var(--brand-green)', fontSize: 13, fontWeight: 900 }
const stepCopyStyle: CSSProperties = { display: 'grid', gap: 3, minWidth: 0 }
const stepLabelStyle: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: 10, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }
const stepTitleStyle: CSSProperties = { color: 'var(--foreground-strong)', fontSize: 14, lineHeight: 1.2 }
const stepDetailStyle: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: 12, lineHeight: 1.42 }
const stepActionStyle: CSSProperties = { gridColumn: '2', justifySelf: 'start', marginTop: 3, padding: '7px 10px', borderRadius: 999, background: 'var(--brand-green)', color: '#071226', fontSize: 12, fontWeight: 900, textDecoration: 'none', textAlign: 'center' }
const doneStyle: CSSProperties = { gridColumn: '2', justifySelf: 'start', marginTop: 3, color: 'var(--brand-green)', fontSize: 12, fontWeight: 900 }
const laterStyle: CSSProperties = { gridColumn: '2', color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 800 }
const completeActionStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '9px 14px', borderRadius: 999, background: 'var(--brand-green)', color: '#071226', fontWeight: 900, textDecoration: 'none', textAlign: 'center', whiteSpace: 'nowrap' }
const completeDetailsStyle: CSSProperties = { gridColumn: '1 / -1', minWidth: 0 }
const summaryStyle: CSSProperties = { color: 'var(--shell-copy-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 850 }
