export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="hero-panel" style={{ padding: '32px 28px', minHeight: 140 }}>
          <Bone style={{ width: '38%', height: 26, borderRadius: 10, marginBottom: 12 }} />
          <Bone style={{ width: '26%', height: 16, borderRadius: 8 }} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Bone key={i} style={{ width: 80, height: 34, borderRadius: 999 }} />
            ))}
          </div>
          <Bone style={{ width: 160, height: 34, borderRadius: 12 }} />
        </div>

        <div className="stack-list">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="list-row" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                <Bone style={{ width: 36, height: 36, borderRadius: 999, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'grid', gap: 6 }}>
                  <Bone style={{ width: `${55 - i * 2}%`, height: 14, borderRadius: 8 }} />
                  <Bone style={{ width: `${35 - i}%`, height: 11, borderRadius: 8 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Bone style={{ width: 48, height: 28, borderRadius: 8 }} />
                <Bone style={{ width: 48, height: 28, borderRadius: 8 }} />
                <Bone style={{ width: 48, height: 28, borderRadius: 8 }} />
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
