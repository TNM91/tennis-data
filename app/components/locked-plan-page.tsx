'use client'

import type { CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import type { PricingPlanId } from '@/lib/pricing-plans'

type LockedPlanPageProps = {
  active?: string
  planId: PricingPlanId
  headline: string
  body: string
  result?: string
  ctaLabel?: string
  secondaryLabel?: string
  secondaryHref?: string
}

export default function LockedPlanPage({
  active,
  planId,
  headline,
  body,
  result,
  ctaLabel,
  secondaryLabel = 'See plans',
  secondaryHref = '/pricing',
}: LockedPlanPageProps) {
  return (
    <SiteShell active={active}>
      <div style={pageWrapStyle}>
        <UpgradePrompt
          planId={planId}
          headline={headline}
          body={body}
          result={result}
          ctaLabel={ctaLabel}
          secondaryLabel={secondaryLabel}
          secondaryHref={secondaryHref}
        />
      </div>
    </SiteShell>
  )
}

const pageWrapStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: 'min(1180px, calc(100% - clamp(24px, 5vw, 32px)))',
  margin: '0 auto',
  padding: '28px 0 36px',
  minWidth: 0,
}
