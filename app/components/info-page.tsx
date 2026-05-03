import type { ReactNode } from 'react'

export default function InfoPage({
  kicker,
  title,
  intro,
  children,
}: {
  kicker: string
  title: string
  intro: string
  children: ReactNode
}) {
  return (
    <div className="page-shell-tight">
      <section className="surface-card-strong panel-pad">
        <div className="section-kicker">{kicker}</div>
        <h1 className="page-title">{title}</h1>
        <p
          style={{
            marginTop: 14,
            marginBottom: 0,
            maxWidth: 820,
            color: 'rgba(217,230,246,0.82)',
            fontSize: '1rem',
            lineHeight: 1.8,
          }}
        >
          {intro}
        </p>

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
