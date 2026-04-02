import { ReactNode } from 'react'

export function PageSection({
  kicker,
  title,
  description,
  children,
}: {
  kicker?: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="surface-card surface-card-strong">
      <div className="section-head">
        <div>
          {kicker ? <div className="section-kicker">{kicker}</div> : null}
          <h2 className="section-title">{title}</h2>
          {description ? <p className="section-subtitle">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="metric-grid">{children}</div>
}

export function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string
  value: ReactNode
  accent?: boolean
}) {
  return (
    <div className={accent ? 'metric-card metric-card-accent' : 'metric-card'}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  )
}

export function ActionCard({
  badge,
  title,
  description,
  cta,
}: {
  badge: string
  title: string
  description: string
  cta?: ReactNode
}) {
  return (
    <article className="surface-card action-card">
      <div className="badge">{badge}</div>
      <h3 className="action-card-title">{title}</h3>
      <p className="action-card-text">{description}</p>
      {cta ? <div className="action-card-cta">{cta}</div> : null}
    </article>
  )
}
