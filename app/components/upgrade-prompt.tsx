'use client'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { getPricingPlan, type PricingPlanId } from '@/lib/pricing-plans'

type UpgradePromptProps = {
  planId: PricingPlanId
  headline: string
  body: string
  result?: string
  ctaLabel?: string
  ctaHref?: string
  secondaryLabel?: string
  secondaryHref?: string
  footnote?: string
  compact?: boolean
  children?: ReactNode
}

export default function UpgradePrompt({
  planId,
  headline,
  body,
  result,
  ctaLabel,
  ctaHref = '/pricing',
  secondaryLabel = 'See plans',
  secondaryHref,
  footnote,
  compact = false,
  children,
}: UpgradePromptProps) {
  const plan = getPricingPlan(planId)
  const resolvedResult = result || plan.outcome

  return (
    <section
      style={{
        ...wrapStyle,
        ...(compact ? compactWrapStyle : null),
        ...(planId === 'captain' ? captainWrapStyle : null),
        ...(planId === 'league' ? leagueWrapStyle : null),
      }}
    >
      <div style={contentStyle}>
        <div style={labelRowStyle}>
          <span style={eyebrowStyle}>{plan.name}</span>
          {plan.badge ? <span style={badgeStyle}>{plan.badge}</span> : null}
        </div>

        <h3 style={titleStyle}>{headline}</h3>
        <p style={bodyStyle}>{body}</p>

        <div style={resultWrapStyle}>
          <span style={resultLabelStyle}>Result</span>
          <span style={resultTextStyle}>{resolvedResult}</span>
        </div>

        <div style={planMetaStyle}>
          <span style={priceStyle}>{plan.priceLabel}</span>
          <span style={subtitleStyle}>{plan.subtitle}</span>
          {plan.alternatePriceNote ? <span style={noteStyle}>{plan.alternatePriceNote}</span> : null}
        </div>

        <div style={valueListStyle}>
          {plan.valueProps.slice(0, compact ? 3 : 4).map((valueProp) => (
            <span key={valueProp} style={valuePillStyle}>
              {valueProp}
            </span>
          ))}
        </div>

        {children}

        {footnote ? <div style={footnoteStyle}>{footnote}</div> : null}
      </div>

      <div style={actionRowStyle}>
        <Link href={ctaHref} style={primaryActionStyle}>
          {ctaLabel || plan.ctaLabel}
        </Link>
        {secondaryHref ? (
          <Link href={secondaryHref} style={secondaryActionStyle}>
            {secondaryLabel}
          </Link>
        ) : (
          <span style={secondaryStaticStyle}>{secondaryLabel}</span>
        )}
      </div>
    </section>
  )
}

const wrapStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
  padding: 22,
  borderRadius: 24,
  border: '1px solid rgba(155, 225, 29, 0.18)',
  background:
    'linear-gradient(180deg, rgba(18, 36, 66, 0.74) 0%, rgba(13, 26, 48, 0.92) 100%)',
  boxShadow: '0 18px 48px rgba(2, 10, 24, 0.16)',
}

const compactWrapStyle: CSSProperties = {
  padding: 18,
  gap: 14,
}

const captainWrapStyle: CSSProperties = {
  border: '1px solid rgba(155, 225, 29, 0.22)',
  boxShadow: '0 20px 52px rgba(155, 225, 29, 0.08)',
}

const leagueWrapStyle: CSSProperties = {
  border: '1px solid rgba(116, 190, 255, 0.18)',
}

const contentStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const labelRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const eyebrowStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '28px',
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#dbeafe',
  background: 'rgba(37, 91, 227, 0.14)',
  border: '1px solid rgba(116, 190, 255, 0.18)',
}

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '28px',
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#07121f',
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: 'clamp(1.32rem, 2vw, 1.8rem)',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const bodyStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(229, 238, 251, 0.78)',
  fontSize: 14,
  lineHeight: 1.65,
  maxWidth: 760,
}

const resultWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: '12px 14px',
  borderRadius: 16,
  border: '1px solid rgba(116, 190, 255, 0.12)',
  background: 'rgba(255, 255, 255, 0.04)',
}

const resultLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#9be11d',
}

const resultTextStyle: CSSProperties = {
  color: '#edf4ff',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 700,
}

const planMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  flexWrap: 'wrap',
}

const priceStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: 24,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const subtitleStyle: CSSProperties = {
  color: '#d9f84a',
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const noteStyle: CSSProperties = {
  color: 'rgba(229, 238, 251, 0.72)',
  fontSize: 13,
  fontWeight: 700,
}

const valueListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const valuePillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '32px',
  padding: '0 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  color: '#dbeafe',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(116, 190, 255, 0.12)',
}

const footnoteStyle: CSSProperties = {
  color: 'rgba(229, 238, 251, 0.72)',
  fontSize: 12,
  lineHeight: 1.6,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const primaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  padding: '0 16px',
  borderRadius: 999,
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  color: '#04121a',
  textDecoration: 'none',
  fontWeight: 900,
  boxShadow: '0 14px 28px rgba(155, 225, 29, 0.16)',
}

const secondaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  padding: '0 16px',
  borderRadius: 999,
  border: '1px solid rgba(116, 190, 255, 0.16)',
  background: 'rgba(255, 255, 255, 0.05)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 800,
}

const secondaryStaticStyle: CSSProperties = {
  color: 'rgba(229, 238, 251, 0.7)',
  fontSize: 13,
  fontWeight: 700,
}
