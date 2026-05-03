import type { ReactNode } from 'react'

export default function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string
  effectiveDate?: string
  children: ReactNode
}) {
  return (
    <div className="page-shell-tight">
      <section className="surface-card-strong panel-pad">
        <div className="section-kicker">Legal</div>
        <h1 className="page-title">{title}</h1>
        {effectiveDate ? (
          <p
            style={{
              marginTop: 12,
              marginBottom: 0,
              color: 'rgba(197,213,234,0.78)',
              fontSize: '0.95rem',
              fontWeight: 700,
            }}
          >
            Effective date: {effectiveDate}
          </p>
        ) : null}

        <div
          style={{
            marginTop: 22,
            display: 'grid',
            gap: 18,
            color: 'rgba(229,238,251,0.86)',
            fontSize: '15px',
            lineHeight: 1.75,
          }}
        >
          {children}
        </div>
      </section>
    </div>
  )
}