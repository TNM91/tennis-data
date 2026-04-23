export default function Loading() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar surface-card" style={{ padding: 20, minHeight: 400 }}>
        <Bone style={{ width: '70%', height: 16, borderRadius: 8, marginBottom: 20 }} />
        <div style={{ display: 'grid', gap: 10 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Bone key={i} style={{ width: '100%', height: 42, borderRadius: 14 }} />
          ))}
        </div>
      </aside>

      <main className="admin-main" style={{ display: 'grid', gap: 20 }}>
        <div className="surface-card-strong" style={{ padding: '28px 24px', minHeight: 160 }}>
          <Bone style={{ width: '40%', height: 24, borderRadius: 10, marginBottom: 12 }} />
          <Bone style={{ width: '60%', height: 16, borderRadius: 8 }} />
        </div>
        <div className="card-grid" style={{ gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface-card" style={{ padding: 20, minHeight: 120 }}>
              <Bone style={{ width: '55%', height: 14, borderRadius: 8, marginBottom: 12 }} />
              <Bone style={{ width: '80%', height: 12, borderRadius: 8, marginBottom: 8 }} />
              <Bone style={{ width: '40%', height: 12, borderRadius: 8 }} />
            </div>
          ))}
        </div>
        <div className="surface-card" style={{ padding: 24 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="list-row" style={{ marginBottom: 10 }}>
              <Bone style={{ width: `${70 - i * 5}%`, height: 14, borderRadius: 8 }} />
              <Bone style={{ width: 80, height: 28, borderRadius: 999 }} />
            </div>
          ))}
        </div>
      </main>
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
