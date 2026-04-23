export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="hero-panel" style={{ padding: '32px 28px', minHeight: 140 }}>
          <Bone style={{ width: '44%', height: 26, borderRadius: 10, marginBottom: 10 }} />
          <Bone style={{ width: '28%', height: 16, borderRadius: 8 }} />
        </div>

        <div className="metric-grid four">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="metric-card">
              <Bone style={{ width: '50%', height: 11, borderRadius: 6, marginBottom: 14 }} />
              <Bone style={{ width: '65%', height: 28, borderRadius: 8 }} />
            </div>
          ))}
        </div>

        <div className="stack-list">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="list-row">
              <div style={{ flex: 1 }}>
                <Bone style={{ width: `${58 - i * 4}%`, height: 14, borderRadius: 8, marginBottom: 6 }} />
                <Bone style={{ width: `${38 - i * 2}%`, height: 12, borderRadius: 8 }} />
              </div>
              <Bone style={{ width: 70, height: 32, borderRadius: 999 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Bone({ style }: { style?: React.CSSProperties }) {
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
