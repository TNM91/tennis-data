export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="hero-panel" style={{ padding: '32px 28px', minHeight: 160 }}>
          <Bone style={{ width: 100, height: 13, borderRadius: 999, marginBottom: 18 }} />
          <Bone style={{ width: '48%', height: 28, borderRadius: 10, marginBottom: 10 }} />
          <Bone style={{ width: '32%', height: 18, borderRadius: 8 }} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Bone key={i} style={{ width: 110, height: 38, borderRadius: 999 }} />
          ))}
        </div>

        <div className="card-grid" style={{ gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface-card" style={{ padding: 20, minHeight: 140 }}>
              <Bone style={{ width: '55%', height: 14, borderRadius: 8, marginBottom: 14 }} />
              <Bone style={{ width: '75%', height: 12, borderRadius: 8, marginBottom: 8 }} />
              <Bone style={{ width: '40%', height: 12, borderRadius: 8, marginBottom: 8 }} />
              <Bone style={{ width: '60%', height: 12, borderRadius: 8 }} />
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
