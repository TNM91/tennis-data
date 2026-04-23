export default function Loading() {
  return (
    <div className="page-shell">
      <div style={{ display: 'grid', gap: 28 }}>
        <div style={{ textAlign: 'center', padding: '32px 0 8px' }}>
          <Bone style={{ width: 140, height: 14, borderRadius: 999, margin: '0 auto 18px' }} />
          <Bone style={{ width: '45%', height: 32, borderRadius: 12, margin: '0 auto 12px' }} />
          <Bone style={{ width: '30%', height: 18, borderRadius: 8, margin: '0 auto' }} />
        </div>

        <div className="card-grid three" style={{ gap: 20, alignItems: 'stretch' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="surface-card"
              style={{ padding: '28px 24px', display: 'grid', gap: 14 }}
            >
              <Bone style={{ width: '60%', height: 18, borderRadius: 8 }} />
              <Bone style={{ width: '45%', height: 32, borderRadius: 10 }} />
              <Bone style={{ width: '80%', height: 13, borderRadius: 8 }} />
              <div style={{ height: 1, background: 'var(--card-border)', margin: '4px 0' }} />
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Bone style={{ width: 16, height: 16, borderRadius: 999 }} />
                  <Bone style={{ width: `${65 - j * 6}%`, height: 12, borderRadius: 8 }} />
                </div>
              ))}
              <Bone style={{ width: '100%', height: 46, borderRadius: 999, marginTop: 8 }} />
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
