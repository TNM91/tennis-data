'use client'

import type { CSSProperties } from 'react'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import type { CoachLaunchProgress, CoachLaunchStepId } from '@/lib/coach-launch-progress'

type CoachLaunchPathProps = {
  progress: CoachLaunchProgress
}

type CoachLaunchCard = {
  id: CoachLaunchStepId
  title: string
  detail: string
  href: string
  cta: string
}

const CARDS: CoachLaunchCard[] = [
  {
    id: 'player',
    title: 'Add a player',
    detail: 'Start with the player you coach most often.',
    href: '#coach-student-board',
    cta: 'Add player',
  },
  {
    id: 'connection',
    title: 'Send their connection',
    detail: 'Give the player their secure setup link so they can accept.',
    href: '#coach-student-board',
    cta: 'Open setup',
  },
  {
    id: 'assignment',
    title: 'Assign one court task',
    detail: 'Keep the first plan measurable and easy to bring back.',
    href: '#coach-lesson-frame',
    cta: 'Create plan',
  },
  {
    id: 'proof',
    title: 'Review first proof',
    detail: 'Use the player bench when their recap or Level Up work returns.',
    href: '#coach-linked-dashboard',
    cta: 'Open bench',
  },
]

export default function CoachLaunchPath({ progress }: CoachLaunchPathProps) {
  if (progress.complete) {
    return (
      <section style={completePanelStyle} aria-label="Coach launch complete">
        <div style={completeHeaderStyle}>
          <TiqFeatureIcon name="competeTennis" size="md" variant="ghost" />
          <div>
            <div style={eyebrowStyle}>Coach trophy earned</div>
            <h2 style={titleStyle}>First player plan complete</h2>
            <p style={bodyStyle}>A player is connected, their first court task is out, and their proof is back for review.</p>
          </div>
        </div>
        <a href="#coach-linked-dashboard" style={primaryLinkStyle}>Open player bench</a>
        <details style={detailsStyle}>
          <summary style={summaryStyle}>View launch checklist</summary>
          <LaunchCards progress={progress} />
        </details>
      </section>
    )
  }

  return (
    <section style={panelStyle} aria-label="Coach launch path">
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Coach launch</div>
          <h2 style={titleStyle}>Turn one lesson into a clear player loop.</h2>
          <p style={bodyStyle}>Finish these four moves once. Coach Hub will keep the next player action visible after that.</p>
        </div>
        <span style={countStyle}>{progress.completed}/{progress.total} done</span>
      </div>
      <LaunchCards progress={progress} />
    </section>
  )
}

function LaunchCards({ progress }: { progress: CoachLaunchProgress }) {
  return (
    <div style={gridStyle}>
      {CARDS.map((card, index) => {
        const complete = progress.steps[card.id]
        return (
          <article key={card.id} style={cardStyle(complete)}>
            <div style={cardTopStyle}>
              <span style={stepStyle(complete)}>{complete ? 'Done' : `Step ${index + 1}`}</span>
              {complete ? <span aria-label={`${card.title} complete`} style={checkStyle}>✓</span> : null}
            </div>
            <h3 style={cardTitleStyle}>{card.title}</h3>
            <p style={cardBodyStyle}>{card.detail}</p>
            <a href={card.href} style={cardLinkStyle(complete)}>{complete ? 'Review' : card.cta}</a>
          </article>
        )
      })}
    </div>
  )
}

const panelBaseStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 'clamp(16px, 3vw, 24px)',
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.24)',
  background: 'linear-gradient(135deg, rgba(116,190,255,0.1), rgba(155,225,29,0.055)), rgba(7,16,31,0.8)',
  minWidth: 0,
}

const panelStyle: CSSProperties = panelBaseStyle

const completePanelStyle: CSSProperties = {
  ...panelBaseStyle,
  borderColor: 'rgba(155,225,29,0.34)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.14), rgba(116,190,255,0.06)), rgba(7,16,31,0.8)',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  minWidth: 0,
}

const completeHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  minWidth: 0,
}

const eyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: '5px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(20px, 4vw, 28px)',
  lineHeight: 1.08,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const bodyStyle: CSSProperties = {
  margin: '8px 0 0',
  maxWidth: 670,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.5,
  fontWeight: 700,
}

const countStyle: CSSProperties = {
  flex: '0 0 auto',
  padding: '8px 11px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.1)',
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 185px), 1fr))',
  gap: 10,
  minWidth: 0,
}

function cardStyle(complete: boolean): CSSProperties {
  return {
    display: 'grid',
    alignContent: 'start',
    gap: 8,
    minWidth: 0,
    padding: 14,
    borderRadius: 17,
    border: `1px solid ${complete ? 'rgba(155,225,29,0.3)' : 'rgba(255,255,255,0.12)'}`,
    background: complete ? 'rgba(155,225,29,0.075)' : 'rgba(5,11,22,0.38)',
  }
}

const cardTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

function stepStyle(complete: boolean): CSSProperties {
  return {
    color: complete ? 'var(--brand-green)' : 'var(--shell-copy-muted)',
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: '.09em',
    textTransform: 'uppercase',
  }
}

const checkStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 16,
  fontWeight: 950,
}

const cardTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 16,
  lineHeight: 1.15,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const cardBodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

function cardLinkStyle(complete: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    width: 'fit-content',
    maxWidth: '100%',
    marginTop: 2,
    color: complete ? 'var(--shell-copy-muted)' : 'var(--foreground-strong)',
    fontSize: 12,
    fontWeight: 950,
    textDecoration: 'none',
  }
}

const primaryLinkStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  maxWidth: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  background: 'rgba(155,225,29,0.16)',
  border: '1px solid rgba(155,225,29,0.36)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 950,
  textDecoration: 'none',
}

const detailsStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const summaryStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 900,
}
