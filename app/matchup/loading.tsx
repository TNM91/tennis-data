export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="hero-panel" style={{ padding: '36px 32px', minHeight: 180 }}>
          <Bone style={{ width: 110, height: 12, borderRadius: 999, marginBottom: 20 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 24 }}>
            <div>
              <Bone style={{ width: '70%', height: 22, borderRadius: 10, marginBottom: 10 }} />
              <Bone style={{ width: '45%', height: 14, borderRadius: 8 }} />
            </div>
            <Bone style={{ width: 40, height: 24, borderRadius: 8 }} />
            <div>
              <Bone style={{ width: '70%', height: 22, borderRadius: 10, marginBottom: 10 }} />
              <Bone style={{ width: '45%', height: 14, borderRadius: 8 }} />
            </div>
          </div>
        </div>

        <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="metric-card">
              <Bone style={{ width: '50%', height: 10, borderRadius: 6, marginBottom: 12 }} />
              <Bone style={{ width: '65%', height: 28, borderRadius: 8 }} />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="surface-card" style={{ padding: 22 }}>
              <Bone style={{ width: '45%', height: 16, borderRadius: 8, marginBottom: 16 }} />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Bone style={{ width: '40%', height: 13, borderRadius: 8 }} />
                  <Bone style={{ width: '25%', height: 13, borderRadius: 8 }} />
                </div>
              ))}
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
