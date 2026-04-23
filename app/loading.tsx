export default function Loading() {
  return (
    <div className="page-shell">
      <PageSkeleton />
    </div>
  )
}

function PageSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div className="hero-panel" style={{ padding: '36px 32px', minHeight: 180 }}>
        <Bone style={{ width: 120, height: 14, borderRadius: 999, marginBottom: 20 }} />
        <Bone style={{ width: '55%', height: 32, borderRadius: 12, marginBottom: 12 }} />
        <Bone style={{ width: '38%', height: 20, borderRadius: 10 }} />
      </div>
      <div className="card-grid three" style={{ gap: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="surface-card" style={{ padding: 20, minHeight: 120 }}>
            <Bone style={{ width: '60%', height: 16, borderRadius: 8, marginBottom: 12 }} />
            <Bone style={{ width: '80%', height: 12, borderRadius: 8, marginBottom: 8 }} />
            <Bone style={{ width: '45%', height: 12, borderRadius: 8 }} />
          </div>
        ))}
      </div>
      <div className="surface-card" style={{ padding: 24, minHeight: 200 }}>
        <Bone style={{ width: '30%', height: 20, borderRadius: 10, marginBottom: 20 }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} style={{ width: `${85 - i * 8}%`, height: 14, borderRadius: 8, marginBottom: 12 }} />
        ))}
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
