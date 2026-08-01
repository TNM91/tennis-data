'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'

type TennisSetupChecklistProps = {
  hasPlayer: boolean
  hasTeam: boolean
  hasMatchData: boolean
  playerHref?: string
  teamHref?: string
  matchDataHref?: string
  context?: 'player' | 'captain'
}

export default function TennisSetupChecklist({
  hasPlayer,
  hasTeam,
  hasMatchData,
  playerHref = '/profile#profile-identity',
  teamHref = '/data-assist?intent=upload-source&context=Team%20Hub#upload',
  matchDataHref = '/data-assist?intent=upload-source&context=My%20Lab#upload',
  context = 'player',
}: TennisSetupChecklistProps) {
  const steps = [
    {
      complete: hasPlayer,
      label: 'Player',
      title: 'Connect your player.',
      body: 'Choose your player record or create one.',
      href: playerHref,
      action: 'Find my player',
    },
    {
      complete: hasTeam,
      label: 'Team',
      title: context === 'captain' ? 'Add your first team.' : 'Connect your team.',
      body: 'Upload a TennisLink Player Roster to bring in the team and available contact details.',
      href: teamHref,
      action: 'Upload Player Roster',
    },
    {
      complete: hasMatchData,
      label: 'Matches',
      title: 'Add your match data.',
      body: context === 'captain'
        ? 'Add the schedule so Captain can open the next match and weekly tools.'
        : 'Upload a scorecard if your match history is missing.',
      href: matchDataHref,
      action: context === 'captain' ? 'Add schedule' : 'Add match data',
    },
  ]
  const nextIndex = steps.findIndex((step) => !step.complete)
  if (nextIndex === -1) return null
  const next = steps[nextIndex]

  return (
    <section aria-label="Tennis setup" style={panelStyle}>
      <div style={copyStyle}>
        <span style={eyebrowStyle}>Get started · Step {nextIndex + 1} of {steps.length}</span>
        <h2 style={titleStyle}>{next.title}</h2>
        <p style={bodyStyle}>{next.body}</p>
      </div>
      <Link href={next.href} style={actionStyle}>{next.action}</Link>
      <ol aria-label="Setup progress" style={progressStyle}>
        {steps.map((step, index) => (
          <li key={step.label} style={progressItemStyle(step.complete, index === nextIndex)}>
            <span aria-hidden="true">{step.complete ? '✓' : index + 1}</span>
            <span>{step.label}</span>
            <span style={srOnlyStyle}>{step.complete ? ' complete' : index === nextIndex ? ' next' : ' not started'}</span>
          </li>
        ))}
      </ol>
      <Link href="/messages?compose=support&context=Tennis%20setup" style={helpStyle}>Need help?</Link>
    </section>
  )
}

const panelStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignItems: 'center',
  gap: 16,
  minWidth: 0,
  padding: 'clamp(16px, 3vw, 22px)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
  borderRadius: 18,
  background: 'var(--shell-panel-bg-strong)',
  color: 'var(--foreground-strong)',
}
const copyStyle: CSSProperties = { display: 'grid', gap: 5, minWidth: 0 }
const eyebrowStyle: CSSProperties = { color: 'var(--brand-green)', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }
const titleStyle: CSSProperties = { margin: 0, fontSize: 'clamp(20px, 4vw, 26px)', lineHeight: 1.08 }
const bodyStyle: CSSProperties = { margin: 0, color: 'var(--shell-copy-muted)', fontSize: 14, lineHeight: 1.5 }
const actionStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '10px 16px', borderRadius: 999, background: 'var(--brand-green)', color: '#071226', fontWeight: 900, textDecoration: 'none', textAlign: 'center' }
const progressStyle: CSSProperties = { gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 8, margin: 0, padding: 0, listStyle: 'none' }
const progressItemStyle = (complete: boolean, current: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 9px', borderRadius: 999, border: `1px solid ${current ? 'var(--brand-blue)' : 'var(--shell-panel-border)'}`, background: complete ? 'color-mix(in srgb, var(--brand-green) 14%, transparent)' : 'var(--shell-chip-bg)', color: complete ? 'var(--brand-green)' : 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 850 })
const helpStyle: CSSProperties = { gridColumn: '1 / -1', width: 'fit-content', color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 800 }
const srOnlyStyle: CSSProperties = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }
