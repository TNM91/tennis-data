'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import { getClientAuthState } from '@/lib/auth'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { type UserRole } from '@/lib/roles'
import {
  getPricingPlan,
  PRICING_HOW_IT_WORKS,
  PRICING_PLANS,
  PRICING_PROOF_POINTS,
  type PricingPlanId,
} from '@/lib/pricing-plans'
import { PRODUCT_NORTH_STAR, PRODUCT_UPGRADE_MESSAGE } from '@/lib/product-story'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'

const PLAN_ICON_BY_ID: Record<PricingPlanId, TiqFeatureIconName> = {
  free: 'playerRatings',
  player_plus: 'myLab',
  captain: 'lineupBuilder',
  league: 'teamRankings',
}

const PLAN_VERBS: Record<PricingPlanId, string> = {
  free: 'Explore',
  player_plus: 'Personalize',
  captain: 'Lead',
  league: 'Organize',
}

const VALUE_MOMENTS: {
  title: string
  cue: string
  icon: TiqFeatureIconName
  href: string
}[] = [
  {
    title: 'Need context?',
    cue: 'Search players, teams, leagues, and rankings first.',
    icon: 'opponentScouting',
    href: '/explore',
  },
  {
    title: 'Want your scorecard?',
    cue: 'Unlock My Lab when the site should revolve around your game.',
    icon: 'myLab',
    href: '#player_plus',
  },
  {
    title: 'Making decisions?',
    cue: 'Use Captain tools when lineup week needs one cleaner flow.',
    icon: 'lineupBuilder',
    href: '#captain',
  },
]

const PERSONALIZATION_FLOW: {
  title: string
  cue: string
  icon: TiqFeatureIconName
}[] = [
  {
    title: 'Create account',
    cue: 'Start free and explore the tennis landscape.',
    icon: 'accountSecurity',
  },
  {
    title: 'Connect identity',
    cue: 'Player and higher tiers link your player record once.',
    icon: 'playerRatings',
  },
  {
    title: 'Open your tools',
    cue: 'My Lab, Matchup, and captain flows start with your context.',
    icon: 'myLab',
  },
]

const PLAN_DECISION_HINTS: Record<PricingPlanId, string> = {
  free: 'Look around first',
  player_plus: 'Make it yours',
  captain: 'Run match week',
  league: 'Organize the season',
}

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
  const recommendedPlan = getPricingPlan(access.recommendedUpgradePlanId ?? access.currentPlanId)
  const currentPlan = getPricingPlan(access.currentPlanId)

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

        <section style={decisionPathStyle} aria-label="Membership path">
          {PRICING_PLANS.map((plan, index) => {
            const active = isPlanActive(plan.id, access)
            const recommended = !active && (access.recommendedUpgradePlanId === plan.id || plan.badge === 'Most Popular')
            return (
              <a
                key={plan.id}
                href={`#${plan.id}`}
                style={{
                  ...decisionStepStyle,
                  ...(active ? decisionStepActiveStyle : null),
                  ...(recommended ? decisionStepRecommendedStyle : null),
                }}
              >
                <span style={decisionNumberStyle}>{index + 1}</span>
                <TiqFeatureIcon name={PLAN_ICON_BY_ID[plan.id]} size="sm" variant="ghost" />
                <span style={decisionStepTextStyle}>
                  <strong>{PLAN_VERBS[plan.id]}</strong>
                  <em>{plan.name}</em>
                </span>
              </a>
            )
          })}
        </section>

        <section style={recommendationStripStyle}>
          <TiqFeatureIcon name={PLAN_ICON_BY_ID[recommendedPlan.id]} size="md" variant="surface" />
          <div style={recommendationCopyStyle}>
            <div style={sectionEyebrowStyle}>
              {access.currentPlanId === recommendedPlan.id ? 'Current access' : 'Recommended next'}
            </div>
            <h2 style={recommendationTitleStyle}>
              {access.currentPlanId === recommendedPlan.id
                ? `${currentPlan.name} is active.`
                : `${PLAN_VERBS[recommendedPlan.id]} with ${recommendedPlan.name}.`}
            </h2>
            <p style={recommendationTextStyle}>
              {access.currentPlanId === recommendedPlan.id
                ? 'You already have the right access for this role. Open the tools that match how you play or lead.'
                : recommendedPlan.outcome}
            </p>
          </div>
          <Link
            href={getPlanHref(recommendedPlan.id, access.currentPlanId === recommendedPlan.id)}
            style={featuredCtaStyle}
          >
            {getPlanCta(recommendedPlan.id, access.currentPlanId === recommendedPlan.id)}
          </Link>
        </section>

        <section style={identityBridgeStyle}>
          <div style={identityBridgeHeaderStyle}>
            <div>
              <div style={sectionEyebrowStyle}>Personalization setup</div>
              <h2 style={identityBridgeTitleStyle}>Player tools start by knowing who you are.</h2>
            </div>
            <Link href="/profile" style={ctaStyle}>Manage profile</Link>
          </div>
          <div style={identityFlowGridStyle}>
            {PERSONALIZATION_FLOW.map((step) => (
              <div key={step.title} style={identityFlowCardStyle}>
                <TiqFeatureIcon name={step.icon} size="md" variant="ghost" />
                <span style={identityFlowCopyStyle}>
                  <strong>{step.title}</strong>
                  <em style={identityFlowCueStyle}>{step.cue}</em>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section style={cardGridStyle}>
          {PRICING_PLANS.map((plan) => {
            const active = isPlanActive(plan.id, access)
            const recommended = access.recommendedUpgradePlanId === plan.id || plan.badge === 'Most Popular'
            return (
              <article
                id={plan.id}
                key={plan.id}
                style={{
                  ...planCardStyle,
                  ...(recommended ? recommendedCardStyle : null),
                  ...(plan.id === 'captain' ? featuredCardStyle : null),
                  ...(active ? activeCardStyle : null),
                }}
              >
                <div style={cardTopStyle}>
                  <TiqFeatureIcon name={PLAN_ICON_BY_ID[plan.id]} size="lg" variant="surface" />
                  <div style={cardLabelRowStyle}>
                    <span style={cardPlanStyle}>{plan.name}</span>
                    {!active && plan.badge ? <span style={badgeStyle}>{plan.badge}</span> : null}
                    {recommended && !active ? <span style={recommendedBadgeStyle}>Recommended next</span> : null}
                    {active ? <span style={activeBadgeStyle}>Access active</span> : null}
                  </div>
                  <div style={cardPriceStyle}>{active ? 'Unlocked' : plan.priceLabel}</div>
                  {!active && plan.alternatePriceNote ? <div style={altPriceStyle}>{plan.alternatePriceNote}</div> : null}
                  <div style={cardSubtitleStyle}>{plan.subtitle}</div>
                  <div style={decisionHintStyle}>{PLAN_DECISION_HINTS[plan.id]}</div>
                </div>

                <div style={solutionCardStyle}>
                  <div style={problemLabelStyle}>{active ? 'Your access' : 'Result'}</div>
                  <div style={solutionTextStyle}>{plan.outcome}</div>
                </div>

                <div style={featureListStyle}>
                  {plan.valueProps.slice(0, 2).map((valueProp) => (
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
            <div style={sectionEyebrowStyle}>Pick by need</div>
            <h2 style={sectionTitleStyle}>Upgrade when the next job is obvious.</h2>
            <div style={momentGridStyle}>
              {VALUE_MOMENTS.map((moment) => (
                <Link key={moment.title} href={moment.href} style={momentCardStyle}>
                  <TiqFeatureIcon name={moment.icon} size="md" variant="ghost" />
                  <span style={momentCopyStyle}>
                    <strong>{moment.title}</strong>
                    <em>{moment.cue}</em>
                  </span>
                </Link>
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
    if (planId === 'player_plus') return '/profile'
    return '/players'
  }

  if (planId === 'captain') return '/captain'
  if (planId === 'league') return '/captain/season-dashboard'
  if (planId === 'player_plus') return '/profile'
  return '/join'
}

function getPlanCta(planId: PricingPlanId, active: boolean) {
  if (active) {
    if (planId === 'captain') return 'Open Captain tools'
    if (planId === 'league') return 'Open league desk'
    if (planId === 'player_plus') return 'Personalize My Lab'
    return 'Explore players'
  }

  if (planId === 'free') return 'Start free'
  if (planId === 'player_plus') return 'Set up My Lab'
  if (planId === 'captain') return 'Open Captain tools'
  return 'Run a league'
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
  color: 'var(--foreground-strong)',
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
  letterSpacing: 0,
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

const decisionPathStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 10,
  padding: 12,
  borderRadius: 24,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 14px 34px rgba(2, 10, 24, 0.08)',
}

const decisionStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px 34px 1fr',
  alignItems: 'center',
  gap: 10,
  minHeight: 76,
  padding: '12px',
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
}

const decisionStepActiveStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 34%, var(--shell-panel-border) 66%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 10%, var(--shell-chip-bg) 90%)',
}

const decisionStepRecommendedStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 36%, var(--shell-panel-border) 64%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
}

const decisionNumberStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 28,
  height: 28,
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 900,
}

const decisionStepTextStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  fontSize: 14,
  lineHeight: 1.15,
}

const recommendationStripStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 16,
  padding: 18,
  borderRadius: 24,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--shell-panel-bg) 90%, var(--brand-green) 10%) 0%, var(--shell-panel-bg) 100%)',
  boxShadow: '0 14px 34px rgba(2, 10, 24, 0.10)',
}

const recommendationCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
}

const recommendationTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
  lineHeight: 1.05,
  fontWeight: 950,
  letterSpacing: 0,
}

const recommendationTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 700,
}

const identityBridgeStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 28,
  border: '1px solid var(--shell-panel-border)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--shell-panel-bg) 92%, var(--brand-blue-2) 8%) 0%, var(--shell-panel-bg) 100%)',
  boxShadow: '0 18px 44px rgba(2, 10, 24, 0.10)',
}

const identityBridgeHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 14,
  flexWrap: 'wrap',
}

const identityBridgeTitleStyle: CSSProperties = {
  margin: '5px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.4rem, 2.2vw, 2rem)',
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
}

const identityFlowGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
}

const identityFlowCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '54px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 12,
  minHeight: 92,
  padding: 14,
  borderRadius: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const identityFlowCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.2,
}

const identityFlowCueStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontStyle: 'normal',
  fontWeight: 700,
  lineHeight: 1.45,
}

const cardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 16,
}

const planCardStyle: CSSProperties = {
  display: 'grid',
  gap: 15,
  padding: 22,
  borderRadius: 28,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 18px 44px rgba(2, 10, 24, 0.12)',
}

const recommendedCardStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
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

const recommendedBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '26px',
  padding: '0 10px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 16%, var(--shell-chip-bg) 84%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 30%, var(--shell-panel-border) 70%)',
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
  letterSpacing: 0,
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

const decisionHintStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 11px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontSize: 13,
  fontWeight: 900,
}

const problemLabelStyle: CSSProperties = {
  color: 'color-mix(in srgb, var(--brand-blue) 72%, var(--foreground-strong) 28%)',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
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
  letterSpacing: 0,
}

const momentGridStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const momentCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '56px 1fr',
  alignItems: 'center',
  gap: 14,
  minHeight: 92,
  padding: 14,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
}

const momentCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  fontSize: 15,
  lineHeight: 1.25,
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
