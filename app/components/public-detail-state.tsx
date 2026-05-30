import Link from 'next/link'
import type { CSSProperties } from 'react'

type PublicDetailStateAction = {
  href: string
  label: string
}

type PublicDetailStateSignal = {
  label: string
  value: string
}

export default function PublicDetailState({
  eyebrow,
  title,
  body,
  titleAs = 'h1',
  signals = [],
  actions = [],
}: {
  eyebrow: string
  title: string
  body: string
  titleAs?: 'h1' | 'h2'
  signals?: PublicDetailStateSignal[]
  actions?: PublicDetailStateAction[]
}) {
  const titleId = `${slugifyForId(eyebrow)}-${slugifyForId(title)}-title`
  const bodyId = `${slugifyForId(eyebrow)}-${slugifyForId(title)}-body`

  return (
    <section style={stateShellStyle} aria-labelledby={titleId} aria-describedby={bodyId}>
      <div style={copyStyle}>
        <div style={eyebrowStyle}>{eyebrow}</div>
        {titleAs === 'h2' ? (
          <h2 id={titleId} style={titleStyle}>{title}</h2>
        ) : (
          <h1 id={titleId} style={titleStyle}>{title}</h1>
        )}
        <p id={bodyId} style={bodyStyle}>{body}</p>
      </div>
      {signals.length ? (
        <dl style={signalGridStyle} aria-label={`${title} signals`}>
          {signals.map((signal) => (
            <div key={`${signal.label}-${signal.value}`} style={signalStyle}>
              <dt>{signal.label}</dt>
              <dd>{signal.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {actions.length ? (
        <div style={actionRowStyle} aria-label={`${title} actions`}>
          {actions.map((action) => (
            <Link key={`${action.href}-${action.label}`} href={action.href} style={actionStyle}>
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function slugifyForId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'detail-state'
}

const stateShellStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const copyStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const eyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.7rem, 3vw, 2.6rem)',
  lineHeight: 1.06,
  fontWeight: 950,
  letterSpacing: 0,
}

const bodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 15,
  lineHeight: 1.65,
  fontWeight: 700,
}

const signalGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const signalStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 11,
  borderRadius: 8,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
  minWidth: 0,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const actionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 40,
  padding: '0 13px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
  textDecoration: 'none',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  textAlign: 'center',
}
