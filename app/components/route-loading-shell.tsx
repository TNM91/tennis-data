import type { CSSProperties } from 'react'
import TiqLoader from '@/components/TiqLoader'
import TennisStateArt, { type TennisStateVisual } from '@/app/components/tennis-state-art'

type RouteLoadingShellProps = {
  label?: string
  detail?: string
  pattern?: 'cards' | 'list' | 'dashboard' | 'matchup' | 'workflow' | 'upload'
  visual?: TennisStateVisual
}

export default function RouteLoadingShell({
  label = 'Preparing TenAceIQ...',
  detail,
  pattern = 'cards',
  visual,
}: RouteLoadingShellProps) {
  const resolvedVisual = visual ?? getLoadingVisual(pattern)
  const resolvedDetail = detail ?? getLoadingDetail(pattern)

  return (
    <div className="page-shell">
      <section
        aria-busy="true"
        aria-live="polite"
        data-loading-visual={resolvedVisual}
        role="status"
        style={shellStyle}
      >
        <TennisStateArt compact visual={resolvedVisual} />
        <div style={contentLayerStyle}>
          <TiqLoader label={label} size="md" />
          <p style={detailStyle}>{resolvedDetail}</p>
          <LoadingPattern pattern={pattern} />
        </div>
      </section>
    </div>
  )
}

function getLoadingVisual(pattern: RouteLoadingShellProps['pattern']): TennisStateVisual {
  if (pattern === 'matchup') return 'matchup'
  if (pattern === 'workflow') return 'captain'
  if (pattern === 'dashboard') return 'team'
  if (pattern === 'list') return 'player'
  return 'generic'
}

function getLoadingDetail(pattern: RouteLoadingShellProps['pattern']) {
  if (pattern === 'matchup') return 'Checking the players, recent form, and court context behind the next matchup read.'
  if (pattern === 'workflow') return 'Connecting the tennis decisions that move this workflow from setup to the next action.'
  if (pattern === 'dashboard') return 'Bringing the latest roster, results, and tennis signals into view.'
  if (pattern === 'list') return 'Reviewing the tennis records behind this directory before the first decision.'
  if (pattern === 'upload') return 'Preparing the source review path so tennis context can be checked and updated.'
  return 'Preparing the tennis context and next actions for this page.'
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
  position: 'relative',
  display: 'grid',
  padding: '24px clamp(16px, 3vw, 28px) 30px',
  borderRadius: 26,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(145deg, rgba(14,35,61,0.9), rgba(6,19,37,0.96))',
  boxShadow: '0 24px 58px rgba(2,10,24,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
  overflow: 'hidden',
  isolation: 'isolate',
}

const contentLayerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: 18,
  justifyItems: 'center',
  width: '100%',
  minWidth: 0,
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
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)',
  alignItems: 'center',
  gap: 18,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const matchupCardStyle: CSSProperties = {
  minWidth: 0,
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
