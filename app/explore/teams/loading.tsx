export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="hero-panel" style={{ padding: '32px 28px', minHeight: 140 }}>
          <Bone style={{ width: '36%', height: 26, borderRadius: 10, marginBottom: 10 }} />
          <Bone style={{ width: '24%', height: 16, borderRadius: 8 }} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Bone key={i} style={{ width: 80, height: 34, borderRadius: 999 }} />
            ))}
          </div>
          <Bone style={{ width: 180, height: 34, borderRadius: 12 }} />
        </div>

        <div className="card-grid" style={{ gap: 14 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="surface-card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <Bone style={{ width: `${140 - i * 6}px`, height: 15, borderRadius: 8, marginBottom: 8 }} />
                  <Bone style={{ width: `${100 - i * 4}px`, height: 12, borderRadius: 8 }} />
                </div>
                <Bone style={{ width: 56, height: 28, borderRadius: 999 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Bone style={{ width: 50, height: 22, borderRadius: 8 }} />
                <Bone style={{ width: 50, height: 22, borderRadius: 8 }} />
              </div>
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
