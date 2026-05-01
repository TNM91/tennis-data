'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import TierPathway from '@/app/components/tier-pathway'
import { getClientAuthState } from '@/lib/auth'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { type UserRole } from '@/lib/roles'
import {
  getPricingPlan,
  PRICING_HOW_IT_WORKS,
  PRICING_PLANS,
  PRICING_PROOF_POINTS,
  WHY_TENACEIQ_POINTS,
  type PricingPlanId,
} from '@/lib/pricing-plans'
import { PRODUCT_NORTH_STAR, PRODUCT_UPGRADE_MESSAGE } from '@/lib/product-story'

export default function PricingPage() {
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)

  useEffect(() => {
    let active = true

    void (async () => {
      const authState = await getClientAuthState()
      if (!active) return
      setRole(authState.role)
      setEntitlements(authState.entitlements)
    })()

    return () => {
      active = false
    }
  }, [])

  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

  return (
    <SiteShell active="">
      <section style={pageWrapStyle}>
        <section style={heroStyle}>
          <div style={eyebrowStyle}>Pricing</div>
          <h1 style={heroTitleStyle}>Free to explore. Player to personalize. Captain to lead.</h1>
          <p style={heroTextStyle}>
            {PRODUCT_NORTH_STAR} {PRODUCT_UPGRADE_MESSAGE}
          </p>

          <div style={proofRowStyle}>
            {PRICING_PROOF_POINTS.map((point) => (
              <span key={point} style={proofPillStyle}>
                {point}
              </span>
            ))}
          </div>
        </section>

        <TierPathway
          showCtas
          title="Start free. Add the tier that removes the next headache."
          intro="Each plan is meant to solve a specific tennis job: exploration, personal prep, team leadership, or league operations."
        />

        <section style={cardGridStyle}>
          {PRICING_PLANS.map((plan) => {
            const active = isPlanActive(plan.id, access)
            const recommended = access.recommendedUpgradePlanId === plan.id || plan.badge === 'Most Popular'
            return (
              <article
                key={plan.id}
                style={{
                  ...planCardStyle,
                  ...(plan.id === 'captain' ? featuredCardStyle : null),
                  ...(active ? activeCardStyle : null),
                }}
              >
                <div style={cardTopStyle}>
                  <div style={cardLabelRowStyle}>
                    <span style={cardPlanStyle}>{plan.name}</span>
                    {!active && plan.badge ? <span style={badgeStyle}>{plan.badge}</span> : null}
                    {active ? <span style={activeBadgeStyle}>Access active</span> : null}
                  </div>
                  <div style={cardPriceStyle}>{active ? 'Unlocked' : plan.priceLabel}</div>
                  {!active && plan.alternatePriceNote ? <div style={altPriceStyle}>{plan.alternatePriceNote}</div> : null}
                  <div style={cardSubtitleStyle}>{plan.subtitle}</div>
                  <div style={audienceStyle}>{plan.audience}</div>
                </div>

                <div style={problemBlockStyle}>
                  {active ? (
                    <div style={solutionCardStyle}>
                      <div style={problemLabelStyle}>Your access</div>
                      <div style={solutionTextStyle}>{plan.outcome}</div>
                    </div>
                  ) : (
                    <>
                      <div style={miniSectionStyle}>
                        <div style={problemLabelStyle}>Best for</div>
                        <div style={miniHeadlineStyle}>{plan.audience}</div>
                      </div>
                      <div style={miniSectionStyle}>
                        <div style={problemLabelStyle}>Why upgrade</div>
                        <div style={problemHeadlineStyle}>{plan.problem}</div>
                        <p style={problemTextStyle}>{plan.friction}</p>
                      </div>
                      <div style={solutionGridStyle}>
                        <div style={solutionCardStyle}>
                          <div style={problemLabelStyle}>Solution</div>
                          <div style={solutionTextStyle}>{plan.solution}</div>
                        </div>
                        <div style={solutionCardStyle}>
                          <div style={problemLabelStyle}>Outcome</div>
                          <div style={solutionTextStyle}>{plan.outcome}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div style={featureListStyle}>
                  {plan.valueProps.map((valueProp) => (
                    <div key={valueProp} style={featureRowStyle}>
                      <span style={featureDotStyle} />
                      <span>{valueProp}</span>
                    </div>
                  ))}
                </div>

                <div style={cardActionRowStyle}>
                  <Link href={getPlanHref(plan.id, active)} style={plan.id === 'captain' ? featuredCtaStyle : ctaStyle}>
                    {getPlanCta(plan.id, active)}
                  </Link>
                  {recommended && !active ? (
                    <span style={recommendedHintStyle}>
                      {plan.id === 'captain'
                        ? 'Best fit for captains who want less guesswork, fewer texts, and stronger weekly decisions.'
                        : `Good next step from ${getPricingPlan(access.currentPlanId).name}.`}
                    </span>
                  ) : null}
                </div>
              </article>
            )
          })}
        </section>

        <section style={supportGridStyle}>
          <article style={supportCardStyle}>
            <div style={sectionEyebrowStyle}>Why TenAceIQ</div>
            <h2 style={sectionTitleStyle}>Built for match week.</h2>
            <div style={supportStackStyle}>
              {WHY_TENACEIQ_POINTS.map((point) => (
                <div key={point.title} style={supportItemStyle}>
                  <div style={supportItemTitleStyle}>{point.title}</div>
                  <div style={supportItemTextStyle}>{point.text}</div>
                </div>
              ))}
            </div>
          </article>

          <article style={supportCardStyle}>
            <div style={sectionEyebrowStyle}>How it works</div>
            <h2 style={sectionTitleStyle}>Start simple.</h2>
            <div style={stepsStyle}>
              {PRICING_HOW_IT_WORKS.map((step, index) => (
                <div key={step} style={stepRowStyle}>
                  <div style={stepNumberStyle}>{index + 1}</div>
                  <div>
                    <div style={stepTitleStyle}>{step}</div>
                    <div style={stepTextStyle}>
                      {index === 0
                        ? 'Create your profile and join your team.'
                        : index === 1
                          ? 'See matches, lineups, and availability.'
                          : 'Add deeper insight or team tools when you need them.'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

      </section>
    </SiteShell>
  )
}

function isPlanActive(planId: PricingPlanId, access: ReturnType<typeof buildProductAccessState>) {
  if (planId === 'free') return access.currentPlanId === 'free'
  if (planId === 'player_plus') return access.canUseAdvancedPlayerInsights
  if (planId === 'captain') return access.canUseCaptainWorkflow
  return access.canUseLeagueTools
}

function getPlanHref(planId: PricingPlanId, active: boolean) {
  if (active) {
    if (planId === 'captain') return '/captain'
    if (planId === 'league') return '/captain/season-dashboard'
    if (planId === 'player_plus') return '/players'
    return '/join'
  }

  if (planId === 'captain') return '/captain'
  if (planId === 'league') return '/captain/season-dashboard'
  return '/join'
}

function getPlanCta(planId: PricingPlanId, active: boolean) {
  if (active) {
    if (planId === 'captain') return 'Open Captain'
    if (planId === 'league') return 'Open League Tools'
    if (planId === 'player_plus') return 'Open Player Tools'
    return 'Get Started Free'
  }

  if (planId === 'captain') return 'Build Smarter Lineups'
  if (planId === 'player_plus') return 'Unlock Matchup with Player'
  return getPricingPlan(planId).ctaLabel
}

const pageWrapStyle: CSSProperties = {
  width: 'min(1280px, calc(100% - 32px))',
  margin: '0 auto',
  padding: '20px 0 36px',
  display: 'grid',
  gap: 20,
}

const heroStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 28,
  borderRadius: 30,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 24px 56px rgba(2, 10, 24, 0.14)',
}

const eyebrowStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(37, 91, 227, 0.12)',
  border: '1px solid rgba(116, 190, 255, 0.16)',
  color: '#dbeafe',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const heroTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2.5rem, 4vw, 4.6rem)',
  lineHeight: 0.98,
  letterSpacing: '-0.05em',
  maxWidth: 980,
}

const heroTextStyle: CSSProperties = {
  margin: 0,
  maxWidth: 860,
  color: 'var(--shell-copy-muted)',
  fontSize: 16,
  lineHeight: 1.75,
}

const proofRowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
}

const proofPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '34px',
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontSize: 13,
  fontWeight: 800,
}

const cardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 16,
}

const planCardStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
  padding: 22,
  borderRadius: 28,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 18px 44px rgba(2, 10, 24, 0.12)',
}

const featuredCardStyle: CSSProperties = {
  border: '1px solid rgba(155, 225, 29, 0.24)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 88%, var(--brand-green) 12%) 0%, color-mix(in srgb, var(--surface) 94%, var(--brand-blue) 6%) 100%)',
  boxShadow: '0 24px 54px rgba(155, 225, 29, 0.08)',
}

const activeCardStyle: CSSProperties = {
  boxShadow: '0 24px 54px rgba(37, 91, 227, 0.08)',
}

const cardTopStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const cardLabelRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const cardPlanStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '26px',
  padding: '0 10px',
  borderRadius: 999,
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  color: '#07121f',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

const activeBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '26px',
  padding: '0 10px',
  borderRadius: 999,
  background: 'rgba(37, 91, 227, 0.12)',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(116, 190, 255, 0.16)',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

const cardPriceStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 32,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const altPriceStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 700,
}

const cardSubtitleStyle: CSSProperties = {
  color: 'color-mix(in srgb, var(--brand-green) 78%, var(--foreground-strong) 22%)',
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const audienceStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.6,
}

const problemBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const problemLabelStyle: CSSProperties = {
  color: 'color-mix(in srgb, var(--brand-blue) 72%, var(--foreground-strong) 28%)',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const miniSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
}

const miniHeadlineStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 16,
  lineHeight: 1.4,
  fontWeight: 800,
}

const problemHeadlineStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.12,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const problemTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.7,
}

const solutionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
}

const solutionCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 12,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const solutionTextStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 700,
}

const featureListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const featureRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '12px 1fr',
  gap: 10,
  alignItems: 'start',
  color: 'var(--foreground)',
  fontSize: 14,
  lineHeight: 1.6,
}

const featureDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  marginTop: 7,
  borderRadius: 999,
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
}

const cardActionRowStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  alignContent: 'end',
}

const ctaStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: 999,
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  border: '1px solid var(--shell-panel-border)',
  fontWeight: 900,
}

const featuredCtaStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: 999,
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  color: '#04121a',
  textDecoration: 'none',
  fontWeight: 900,
  boxShadow: '0 16px 28px rgba(155, 225, 29, 0.16)',
}

const recommendedHintStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.6,
  fontWeight: 700,
}

const supportGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 16,
}

const supportCardStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 24,
  borderRadius: 28,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 18px 44px rgba(2, 10, 24, 0.12)',
}

const sectionEyebrowStyle: CSSProperties = {
  color: 'color-mix(in srgb, var(--brand-blue) 72%, var(--foreground-strong) 28%)',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 28,
  lineHeight: 1.1,
  letterSpacing: '-0.04em',
}

const supportStackStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const supportItemStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 16,
  borderRadius: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const supportItemTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  fontWeight: 800,
}

const supportItemTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.7,
}

const stepsStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
}

const stepRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '42px 1fr',
  gap: 12,
  alignItems: 'start',
}

const stepNumberStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  color: '#07121f',
  fontWeight: 900,
}

const stepTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 16,
  fontWeight: 800,
}

const stepTextStyle: CSSProperties = {
  marginTop: 4,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.7,
}
