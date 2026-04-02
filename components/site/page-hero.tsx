import { ReactNode } from 'react'

type PageHeroProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  aside?: ReactNode
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
}: PageHeroProps) {
  return (
    <section className="page-hero">
      <div className="page-hero-copy">
        {eyebrow ? <div className="page-eyebrow">{eyebrow}</div> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
        {actions ? <div className="page-hero-actions">{actions}</div> : null}
      </div>

      {aside ? <div className="page-hero-aside">{aside}</div> : null}
    </section>
  )
}
