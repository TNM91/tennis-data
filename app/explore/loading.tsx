export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="hero-panel" style={{ padding: '32px 28px', minHeight: 140 }}>
          <Bone style={{ width: '42%', height: 28, borderRadius: 10, marginBottom: 10 }} />
          <Bone style={{ width: '30%', height: 16, borderRadius: 8 }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Bone key={i} style={{ width: 90, height: 36, borderRadius: 999 }} />
          ))}
        </div>

        <div className="stack-list">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="list-row" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                <Bone style={{ width: 40, height: 40, borderRadius: 999, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <Bone style={{ width: `${60 - i * 3}%`, height: 14, borderRadius: 8, marginBottom: 6 }} />
                  <Bone style={{ width: `${40 - i * 2}%`, height: 12, borderRadius: 8 }} />
                </div>
              </div>
              <Bone style={{ width: 56, height: 28, borderRadius: 999 }} />
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
