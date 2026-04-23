export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="hero-panel" style={{ padding: '32px 28px', minHeight: 160 }}>
          <Bone style={{ width: '42%', height: 26, borderRadius: 10, marginBottom: 10 }} />
          <Bone style={{ width: '28%', height: 16, borderRadius: 8, marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <Bone style={{ width: 90, height: 30, borderRadius: 999 }} />
            <Bone style={{ width: 90, height: 30, borderRadius: 999 }} />
          </div>
        </div>

        <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="metric-card">
              <Bone style={{ width: '50%', height: 10, borderRadius: 6, marginBottom: 12 }} />
              <Bone style={{ width: '65%', height: 26, borderRadius: 8 }} />
            </div>
          ))}
        </div>

        <div className="surface-card" style={{ padding: 22 }}>
          <Bone style={{ width: '35%', height: 18, borderRadius: 8, marginBottom: 18 }} />
          <div className="stack-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="list-row" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
                  <Bone style={{ width: 36, height: 36, borderRadius: 999 }} />
                  <div>
                    <Bone style={{ width: `${120 - i * 8}px`, height: 13, borderRadius: 8, marginBottom: 6 }} />
                    <Bone style={{ width: `${80 - i * 4}px`, height: 11, borderRadius: 8 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Bone style={{ width: 44, height: 26, borderRadius: 8 }} />
                  <Bone style={{ width: 44, height: 26, borderRadius: 8 }} />
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
