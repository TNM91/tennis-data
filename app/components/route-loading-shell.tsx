import type { CSSProperties } from 'react'
import TiqLoader from '@/components/TiqLoader'

type RouteLoadingShellProps = {
  label?: string
  pattern?: 'cards' | 'list' | 'dashboard' | 'matchup'
}

export default function RouteLoadingShell({
  label = 'Loading TenAceIQ...',
  pattern = 'cards',
}: RouteLoadingShellProps) {
  return (
    <div className="page-shell">
      <section style={shellStyle}>
        <TiqLoader label={label} size="md" />
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
  gap: 22,
  justifyItems: 'center',
  padding: '24px 0 34px',
}

const cardGridStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
}

const dashboardStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
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
