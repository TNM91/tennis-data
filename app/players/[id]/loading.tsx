export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="hero-panel" style={{ padding: '36px 32px', minHeight: 200 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <Bone style={{ width: 72, height: 72, borderRadius: 999, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Bone style={{ width: '40%', height: 28, borderRadius: 10, marginBottom: 10 }} />
              <Bone style={{ width: '24%', height: 16, borderRadius: 8, marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <Bone style={{ width: 80, height: 30, borderRadius: 999 }} />
                <Bone style={{ width: 80, height: 30, borderRadius: 999 }} />
                <Bone style={{ width: 80, height: 30, borderRadius: 999 }} />
              </div>
            </div>
          </div>
        </div>

        <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="metric-card">
              <Bone style={{ width: '50%', height: 10, borderRadius: 6, marginBottom: 12 }} />
              <Bone style={{ width: '65%', height: 30, borderRadius: 8 }} />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="surface-card" style={{ padding: 22 }}>
            <Bone style={{ width: '45%', height: 16, borderRadius: 8, marginBottom: 18 }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <Bone style={{ width: `${45 - i * 3}%`, height: 13, borderRadius: 8 }} />
                <Bone style={{ width: '25%', height: 13, borderRadius: 8 }} />
              </div>
            ))}
          </div>
          <div className="surface-card" style={{ padding: 22 }}>
            <Bone style={{ width: '40%', height: 16, borderRadius: 8, marginBottom: 18 }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <Bone style={{ width: `${50 - i * 4}%`, height: 13, borderRadius: 8 }} />
                <Bone style={{ width: '22%', height: 13, borderRadius: 8 }} />
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
