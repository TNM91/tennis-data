export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="hero-panel" style={{ padding: '32px 28px', minHeight: 160 }}>
          <Bone style={{ width: 100, height: 12, borderRadius: 999, marginBottom: 18 }} />
          <Bone style={{ width: '42%', height: 26, borderRadius: 10, marginBottom: 10 }} />
          <Bone style={{ width: '30%', height: 16, borderRadius: 8 }} />
        </div>

        <div className="metric-grid four">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="metric-card">
              <Bone style={{ width: '55%', height: 10, borderRadius: 6, marginBottom: 14 }} />
              <Bone style={{ width: '70%', height: 26, borderRadius: 8 }} />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {Array.from({ length: 2 }).map((_, col) => (
            <div key={col} className="surface-card" style={{ padding: 22 }}>
              <Bone style={{ width: '45%', height: 16, borderRadius: 8, marginBottom: 18 }} />
              <div style={{ display: 'grid', gap: 10 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="list-row" style={{ padding: '12px 14px' }}>
                    <Bone style={{ width: `${60 - i * 5}%`, height: 13, borderRadius: 8 }} />
                    <Bone style={{ width: 44, height: 24, borderRadius: 8 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="surface-card" style={{ padding: 22 }}>
          <Bone style={{ width: '35%', height: 16, borderRadius: 8, marginBottom: 16 }} />
          <div className="stack-list">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="list-row">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
                  <Bone style={{ width: 32, height: 32, borderRadius: 999 }} />
                  <Bone style={{ width: `${50 - i * 4}%`, height: 13, borderRadius: 8 }} />
                </div>
                <Bone style={{ width: 60, height: 28, borderRadius: 999 }} />
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
