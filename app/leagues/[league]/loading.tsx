export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="hero-panel" style={{ padding: '32px 28px', minHeight: 160 }}>
          <Bone style={{ width: 90, height: 12, borderRadius: 999, marginBottom: 18 }} />
          <Bone style={{ width: '50%', height: 26, borderRadius: 10, marginBottom: 10 }} />
          <Bone style={{ width: '34%', height: 16, borderRadius: 8 }} />
        </div>

        <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="metric-card">
              <Bone style={{ width: '55%', height: 10, borderRadius: 6, marginBottom: 12 }} />
              <Bone style={{ width: '60%', height: 26, borderRadius: 8 }} />
            </div>
          ))}
        </div>

        <div className="surface-card" style={{ padding: 24 }}>
          <Bone style={{ width: '30%', height: 18, borderRadius: 8, marginBottom: 18 }} />
          <div className="stack-list">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="list-row" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
                  <Bone style={{ width: 28, height: 28, borderRadius: 8 }} />
                  <Bone style={{ width: `${55 - i * 3}%`, height: 13, borderRadius: 8 }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Bone style={{ width: 40, height: 26, borderRadius: 8 }} />
                  <Bone style={{ width: 40, height: 26, borderRadius: 8 }} />
                </div>
              </div>
            ))}
          </div>
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
