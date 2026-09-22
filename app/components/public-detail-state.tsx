import Link from 'next/link'
import type { CSSProperties } from 'react'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import TennisStateArt, {
  getTennisStateIcon,
  type TennisStateVisual,
} from '@/app/components/tennis-state-art'

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
  visual = 'generic',
  tone = 'neutral',
  compact = false,
}: {
  eyebrow: string
  title: string
  body: string
  titleAs?: 'h1' | 'h2'
  signals?: PublicDetailStateSignal[]
  actions?: PublicDetailStateAction[]
  visual?: TennisStateVisual
  tone?: 'neutral' | 'loading' | 'empty' | 'error' | 'locked'
  compact?: boolean
}) {
  const titleId = `${slugifyForId(eyebrow)}-${slugifyForId(title)}-title`
  const bodyId = `${slugifyForId(eyebrow)}-${slugifyForId(title)}-body`
  const busy = tone === 'loading'

  return (
    <section
      aria-busy={busy || undefined}
      aria-describedby={bodyId}
      aria-labelledby={titleId}
      aria-live={busy ? 'polite' : undefined}
      data-state-tone={tone}
      role={busy ? 'status' : undefined}
      style={{
        ...stateShellStyle,
        ...toneStyles[tone],
        ...(compact ? compactStateShellStyle : null),
      }}
    >
      <TennisStateArt compact={compact} visual={visual} />
      <div style={contentLayerStyle}>
        <div style={headingRowStyle}>
          <TiqFeatureIcon
            name={getTennisStateIcon(visual)}
            size={compact ? 'md' : 'lg'}
            variant="surface"
          />
          <div style={copyStyle}>
            <div style={eyebrowStyle}>{eyebrow}</div>
            {titleAs === 'h2' ? (
              <h2 id={titleId} style={{ ...titleStyle, ...(compact ? compactTitleStyle : null) }}>{title}</h2>
            ) : (
              <h1 id={titleId} style={{ ...titleStyle, ...(compact ? compactTitleStyle : null) }}>{title}</h1>
            )}
            <p id={bodyId} style={{ ...bodyStyle, ...(compact ? compactBodyStyle : null) }}>{body}</p>
          </div>
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
            {actions.map((action, index) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                style={{ ...actionStyle, ...(index === 0 ? primaryActionStyle : null) }}
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function slugifyForId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'detail-state'
}

const stateShellStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 14,
  padding: 20,
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(145deg, rgba(14,35,61,0.94), rgba(6,19,37,0.98))',
  boxShadow: '0 24px 58px rgba(2,10,24,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
  minWidth: 0,
  overflow: 'hidden',
  isolation: 'isolate',
}

const compactStateShellStyle: CSSProperties = {
  padding: 16,
  borderRadius: 20,
}

const contentLayerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: 14,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const headingRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)',
  gap: 14,
  alignItems: 'start',
  minWidth: 0,
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

const compactTitleStyle: CSSProperties = {
  fontSize: 'clamp(1.42rem, 6vw, 2rem)',
}

const bodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 15,
  lineHeight: 1.65,
  fontWeight: 700,
}

const compactBodyStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
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

const primaryActionStyle: CSSProperties = {
  borderColor: 'color-mix(in srgb, var(--brand-green) 48%, var(--shell-panel-border) 52%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 10px 24px rgba(155,225,29,0.08)',
}

const toneStyles: Record<'neutral' | 'loading' | 'empty' | 'error' | 'locked', CSSProperties> = {
  neutral: {},
  loading: {
    borderColor: 'color-mix(in srgb, var(--brand-blue-2) 26%, var(--shell-panel-border) 74%)',
  },
  empty: {
    borderColor: 'color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  },
  error: {
    borderColor: 'rgba(251,146,60,0.3)',
  },
  locked: {
    borderColor: 'color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
  },
}
