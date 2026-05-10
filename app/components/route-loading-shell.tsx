import type { CSSProperties } from 'react'
import TiqLoader from '@/components/TiqLoader'

type RouteLoadingShellProps = {
  label?: string
  detail?: string
  pattern?: 'cards' | 'list' | 'dashboard' | 'matchup' | 'workflow' | 'upload'
}

export default function RouteLoadingShell({
  label = 'Loading TenAceIQ...',
  detail,
  pattern = 'cards',
}: RouteLoadingShellProps) {
  return (
    <div className="page-shell">
      <section style={shellStyle}>
        <TiqLoader label={label} size="md" />
        {detail ? <p style={detailStyle}>{detail}</p> : null}
        <LoadingPattern pattern={pattern} />
      </section>
    </div>
  )
}

function LoadingPattern({ pattern }: { pattern: RouteLoadingShellProps['pattern'] }) {
  if (pattern === 'list') {
    return (
      <div style={listStackStyle}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} style={listRowStyle}>
            <Bone style={{ width: 42, height: 42, borderRadius: 999, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Bone style={{ width: `${62 - index * 4}%`, height: 14, borderRadius: 8, marginBottom: 8 }} />
              <Bone style={{ width: `${42 - index * 2}%`, height: 12, borderRadius: 8 }} />
            </div>
            <Bone style={{ width: 58, height: 28, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    )
  }

  if (pattern === 'dashboard') {
    return (
      <div style={dashboardStyle}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} style={cardStyle}>
            <Bone style={{ width: '44%', height: 12, borderRadius: 8, marginBottom: 14 }} />
            <Bone style={{ width: '58%', height: 28, borderRadius: 10, marginBottom: 10 }} />
            <Bone style={{ width: '74%', height: 12, borderRadius: 8 }} />
          </div>
        ))}
      </div>
    )
  }

  if (pattern === 'matchup') {
    return (
      <div style={matchupStyle}>
        <div style={matchupCardStyle}>
          <Bone style={{ width: '52%', height: 18, borderRadius: 10, marginBottom: 10 }} />
          <Bone style={{ width: '36%', height: 14, borderRadius: 8 }} />
        </div>
        <Bone style={{ width: 42, height: 30, borderRadius: 10 }} />
        <div style={matchupCardStyle}>
          <Bone style={{ width: '52%', height: 18, borderRadius: 10, marginBottom: 10 }} />
          <Bone style={{ width: '36%', height: 14, borderRadius: 8 }} />
        </div>
      </div>
    )
  }

  if (pattern === 'workflow') {
    return (
      <div style={workflowStyle}>
        {['Team scope', 'Availability', 'Lineup', 'Message'].map((label, index) => (
          <div key={label} style={workflowStepStyle}>
            <Bone style={{ width: 34, height: 34, borderRadius: 999, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <Bone style={{ width: `${70 - index * 8}%`, height: 13, borderRadius: 8, marginBottom: 9 }} />
              <Bone style={{ width: `${48 - index * 4}%`, height: 11, borderRadius: 8 }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (pattern === 'upload') {
    return (
      <div style={uploadStyle}>
        <div style={uploadDropStyle}>
          <Bone style={{ width: 66, height: 66, borderRadius: 18, marginBottom: 14 }} />
          <Bone style={{ width: '52%', height: 15, borderRadius: 8, marginBottom: 10 }} />
          <Bone style={{ width: '34%', height: 12, borderRadius: 8 }} />
        </div>
        <div style={uploadQueueStyle}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Bone key={index} style={{ width: `${86 - index * 12}%`, height: 38, borderRadius: 12 }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={cardGridStyle}>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} style={cardStyle}>
          <Bone style={{ width: '58%', height: 16, borderRadius: 8, marginBottom: 12 }} />
          <Bone style={{ width: '78%', height: 12, borderRadius: 8, marginBottom: 8 }} />
          <Bone style={{ width: '46%', height: 12, borderRadius: 8 }} />
        </div>
      ))}
    </div>
  )
}

function Bone({ style }: { style?: CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--surface-soft-strong)',
        animation: 'tenaceiq-pulse 1.6s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

const shellStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
  justifyItems: 'center',
  padding: '24px 0 34px',
}

const detailStyle: CSSProperties = {
  margin: '-8px 0 4px',
  maxWidth: 560,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 700,
  textAlign: 'center',
}

const cardGridStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 16,
}

const dashboardStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 14,
}

const cardStyle: CSSProperties = {
  minHeight: 118,
  padding: 20,
  borderRadius: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
}

const listStackStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gap: 10,
}

const listRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  minHeight: 72,
  padding: '14px 16px',
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
}

const matchupStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
  alignItems: 'center',
  gap: 18,
}

const matchupCardStyle: CSSProperties = {
  minHeight: 110,
  padding: 20,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
}

const workflowStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 12,
}

const workflowStepStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
  minHeight: 82,
  padding: '14px 16px',
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
}

const uploadStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 14,
  alignItems: 'stretch',
}

const uploadDropStyle: CSSProperties = {
  minHeight: 180,
  display: 'grid',
  placeItems: 'center',
  alignContent: 'center',
  padding: 22,
  borderRadius: 22,
  border: '1px dashed color-mix(in srgb, var(--brand-blue-2) 34%, var(--shell-panel-border) 66%)',
  background: 'var(--shell-panel-bg)',
}

const uploadQueueStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'center',
  gap: 12,
  minHeight: 180,
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
}
