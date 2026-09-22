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
            marginTop: 8,
            marginBottom: 0,
            maxWidth: 820,
            color: 'rgba(217,230,246,0.82)',
            fontSize: '0.94rem',
            lineHeight: 1.5,
          }}
        >
          {intro}
        </p>

        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gap: 10,
            color: 'rgba(229,238,251,0.86)',
            fontSize: '15px',
            lineHeight: 1.5,
          }}
        >
          {children}
        </div>
      </section>
    </div>
  )
}
