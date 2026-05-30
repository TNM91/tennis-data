import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

type DirectoryFallbackAction = {
  href: string
  label: string
}

export default function TiqDirectoryFallbackCard({
  eyebrow,
  title,
  body,
  chips,
  actions = [],
}: {
  eyebrow: string
  title: string
  body: string
  chips: string[]
  actions?: DirectoryFallbackAction[]
}) {
  const titleId = `${slugifyForId(eyebrow)}-${slugifyForId(title)}-title`
  const bodyId = `${slugifyForId(eyebrow)}-${slugifyForId(title)}-body`

  return (
    <article style={cardStyle} aria-labelledby={titleId} aria-describedby={bodyId}>
      <div style={eyebrowStyle}>{eyebrow}</div>
      <h2 id={titleId} style={titleStyle}>{title}</h2>
      <p id={bodyId} style={bodyStyle}>{body}</p>
      <div style={chipRowStyle} role="list" aria-label={`${title} signals`}>
        {chips.map((chip) => (
          <span key={chip} style={chipStyle} role="listitem">
            {chip}
          </span>
        ))}
      </div>
      {actions.length ? (
        <div style={actionRowStyle} aria-label={`${title} actions`}>
          {actions.map((action) => (
            <FallbackLink key={`${action.href}-${action.label}`} href={action.href}>
              {action.label}
            </FallbackLink>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function slugifyForId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'directory-fallback'
}

function FallbackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} style={actionStyle}>
      {children}
    </Link>
  )
}

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 16,
  padding: 16,
  borderRadius: 20,
  border: '1px solid rgba(155,225,29,0.20)',
  background:
    'linear-gradient(135deg, rgba(155,225,29,0.10), rgba(7,17,33,0.72) 48%, rgba(8,16,34,0.82))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const eyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: 0,
}

const bodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
  fontWeight: 650,
}

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 850,
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  textAlign: 'center',
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
  minHeight: 38,
  padding: '0 13px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
  maxWidth: '100%',
  minWidth: 0,
  whiteSpace: 'normal',
  textAlign: 'center',
  overflowWrap: 'anywhere',
}
