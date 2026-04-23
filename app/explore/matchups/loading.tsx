export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="hero-panel" style={{ padding: '32px 28px', minHeight: 140 }}>
          <Bone style={{ width: '44%', height: 26, borderRadius: 10, marginBottom: 10 }} />
          <Bone style={{ width: '28%', height: 16, borderRadius: 8 }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {Array.from({ length: 2 }).map((_, col) => (
            <div key={col} className="surface-card" style={{ padding: 20 }}>
              <Bone style={{ width: '50%', height: 14, borderRadius: 8, marginBottom: 14 }} />
              <div style={{ display: 'grid', gap: 8 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="list-row" style={{ padding: '10px 14px' }}>
                    <Bone style={{ width: 28, height: 28, borderRadius: 999 }} />
                    <Bone style={{ width: `${65 - i * 8}%`, height: 13, borderRadius: 8, flex: 1 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="surface-card" style={{ padding: 22 }}>
          <Bone style={{ width: '30%', height: 16, borderRadius: 8, marginBottom: 20 }} />
          <div className="stack-list">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="list-row">
                <Bone style={{ width: `${55 - i * 4}%`, height: 14, borderRadius: 8 }} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <Bone style={{ width: 50, height: 28, borderRadius: 8 }} />
                  <Bone style={{ width: 50, height: 28, borderRadius: 8 }} />
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
