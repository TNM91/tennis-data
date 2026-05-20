import Link from 'next/link'
import type { CSSProperties } from 'react'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'

export type InfoActionCard = {
  title: string
  text: string
  href?: string
  cta?: string
  icon: TiqFeatureIconName
}

export default function InfoActionGrid({ cards }: { cards: InfoActionCard[] }) {
  return (
    <div style={gridStyle}>
      {cards.map((card) => {
        const content = (
          <>
            <TiqFeatureIcon name={card.icon} size="md" variant="surface" />
            <span style={copyStyle}>
              <strong>{card.title}</strong>
              <small>{card.text}</small>
              {card.cta ? <em>{card.cta}</em> : null}
            </span>
          </>
        )

        return card.href ? (
          <Link key={card.title} href={card.href} style={cardStyle}>
            {content}
          </Link>
        ) : (
          <div key={card.title} style={cardStyle}>
            {content}
          </div>
        )
      })}
    </div>
  )
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const cardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px minmax(0, 1fr)',
  gap: 12,
  alignItems: 'start',
  minWidth: 0,
  minHeight: 148,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035)',
}

const copyStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  color: 'var(--foreground-strong)',
  lineHeight: 1.25,
  overflowWrap: 'anywhere',
}
