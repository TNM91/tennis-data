export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="hero-panel" style={{ padding: '32px 28px', minHeight: 140 }}>
          <Bone style={{ width: '40%', height: 26, borderRadius: 10, marginBottom: 10 }} />
          <Bone style={{ width: '26%', height: 16, borderRadius: 8 }} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Bone key={i} style={{ width: 100, height: 36, borderRadius: 999 }} />
          ))}
        </div>

        <div className="surface-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Bone key={i} style={{ width: `${80 + i * 20}px`, height: 12, borderRadius: 6 }} />
              ))}
            </div>
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '14px 20px',
                borderBottom: '1px solid var(--card-border)',
              }}
            >
              <Bone style={{ width: 28, height: 14, borderRadius: 6, flexShrink: 0 }} />
              <Bone style={{ width: 36, height: 36, borderRadius: 999, flexShrink: 0 }} />
              <Bone style={{ width: `${160 - i * 6}px`, height: 14, borderRadius: 8, flex: 1 }} />
              <Bone style={{ width: 52, height: 28, borderRadius: 8 }} />
              <Bone style={{ width: 52, height: 28, borderRadius: 8 }} />
              <Bone style={{ width: 52, height: 28, borderRadius: 8 }} />
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
