'use client'

import type { CSSProperties } from 'react'

export type CoachPriorityAction = {
  label: string
  title: string
  detail: string
  href: string
  tone: 'question' | 'review' | 'due' | 'setup' | 'assign' | 'steady'
  studentLinkId?: string
}

type CoachPriorityQueueProps = {
  actions: CoachPriorityAction[]
  questionCount: number
  onSelectStudent?: (studentLinkId: string) => void
}

export default function CoachPriorityQueue({ actions, questionCount, onSelectStudent }: CoachPriorityQueueProps) {
  return (
    <div style={queueStyle} aria-label="Coach priority queue">
      <div style={introStyle}>
        <div>
          <span style={eyebrowStyle}>Today&apos;s coach queue</span>
          <strong>{questionCount ? 'Answer player questions first.' : 'Start with the player who needs action first.'}</strong>
        </div>
        {questionCount ? <span style={countStyle}>{questionCount} question{questionCount === 1 ? '' : 's'}</span> : null}
      </div>
      <div style={gridStyle}>
        {actions.map((action) => (
          <a
            key={action.title}
            href={action.href}
            style={cardStyle(action.tone)}
            onClick={() => {
              if (action.studentLinkId) onSelectStudent?.(action.studentLinkId)
            }}
          >
            <span style={toneStyle(action.tone)}>{action.label}</span>
            <strong>{action.title}</strong>
            <em>{action.detail}</em>
          </a>
        ))}
      </div>
    </div>
  )
}

const queueStyle: CSSProperties = {
  display: 'grid', gap: 10, padding: 13, borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(5,11,22,0.30)', minWidth: 0,
}
const introStyle: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
  color: 'var(--foreground-strong)', fontSize: 14, fontWeight: 950, minWidth: 0,
}
const eyebrowStyle: CSSProperties = {
  display: 'block', color: 'var(--brand-green)', fontSize: 10, fontWeight: 950,
  letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 2,
}
const countStyle: CSSProperties = {
  width: 'fit-content', borderRadius: 999, border: '1px solid rgba(255,196,87,0.38)',
  background: 'rgba(255,196,87,0.12)', color: '#ffd27a', padding: '5px 9px', fontSize: 10, fontWeight: 950,
}
const gridStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 9, minWidth: 0,
}

function cardStyle(tone: CoachPriorityAction['tone']): CSSProperties {
  const question = tone === 'question'
  const urgent = tone === 'review' || tone === 'due'
  const setup = tone === 'setup'
  return {
    display: 'grid', gap: 6, minWidth: 0, padding: 12, borderRadius: 16,
    border: question
      ? '1px solid rgba(255,196,87,0.38)'
      : urgent
        ? '1px solid rgba(155,225,29,0.30)'
        : setup ? '1px solid rgba(116,190,255,0.24)' : '1px solid rgba(255,255,255,0.10)',
    background: question
      ? 'linear-gradient(135deg, rgba(255,196,87,0.12), rgba(255,255,255,0.045))'
      : urgent
        ? 'linear-gradient(135deg, rgba(155,225,29,0.12), rgba(255,255,255,0.045))'
        : setup
          ? 'linear-gradient(135deg, rgba(116,190,255,0.10), rgba(255,255,255,0.04))'
          : 'rgba(255,255,255,0.045)',
    color: 'var(--foreground-strong)', textDecoration: 'none', fontSize: 13, lineHeight: 1.4, overflowWrap: 'anywhere',
    boxShadow: question
      ? '0 14px 30px rgba(255,196,87,0.08)'
      : urgent ? '0 14px 30px rgba(155,225,29,0.08)' : 'none',
  }
}

function toneStyle(tone: CoachPriorityAction['tone']): CSSProperties {
  const question = tone === 'question'
  const urgent = tone === 'review' || tone === 'due'
  return {
    width: 'fit-content', borderRadius: 999,
    border: question
      ? '1px solid rgba(255,196,87,0.38)'
      : urgent ? '1px solid rgba(155,225,29,0.32)' : '1px solid rgba(255,255,255,0.12)',
    background: question ? 'rgba(255,196,87,0.12)' : urgent ? 'rgba(155,225,29,0.14)' : 'rgba(255,255,255,0.055)',
    color: question ? '#ffd27a' : urgent ? 'var(--brand-green)' : 'var(--shell-copy-muted)',
    padding: '3px 8px', fontSize: 10, fontWeight: 950, letterSpacing: '.06em', textTransform: 'uppercase',
  }
}
