export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="hero-panel" style={{ padding: '32px 28px', minHeight: 140 }}>
          <Bone style={{ width: '38%', height: 26, borderRadius: 10, marginBottom: 10 }} />
          <Bone style={{ width: '25%', height: 16, borderRadius: 8 }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Bone key={i} style={{ width: 90, height: 36, borderRadius: 999 }} />
          ))}
        </div>

        <div className="card-grid three" style={{ gap: 16 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="surface-card" style={{ padding: 20, minHeight: 110 }}>
              <Bone style={{ width: '65%', height: 15, borderRadius: 8, marginBottom: 10 }} />
              <Bone style={{ width: '45%', height: 12, borderRadius: 8, marginBottom: 8 }} />
              <Bone style={{ width: '35%', height: 12, borderRadius: 8, marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Bone style={{ width: 60, height: 26, borderRadius: 999 }} />
                <Bone style={{ width: 60, height: 26, borderRadius: 999 }} />
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
