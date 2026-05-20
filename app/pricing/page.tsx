'use client'

import Link from 'next/link'
import { Fragment, useMemo, type CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import {
  getPricingPlan,
  getPricingBillingCue,
  PRICING_HOW_IT_WORKS,
  PRICING_PLANS,
  PRICING_PROOF_POINTS,
  type PricingPlanId,
} from '@/lib/pricing-plans'
import { DATA_ASSIST_STORY, getMembershipTier } from '@/lib/product-story'
import { getPlanDestinationHref, getPlanSignupHref } from '@/lib/plan-intent'
import { BILLING_SUPPORT_PATH } from '@/lib/billing-policy'
import { SUPPORT_THREAD_ASSURANCE } from '@/lib/message-links'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const PLAN_ICON_BY_ID: Record<PricingPlanId, TiqFeatureIconName> = {
  free: 'playerRatings',
  player_plus: 'myLab',
  captain: 'lineupBuilder',
  league: 'teamRankings',
}

const PLAN_VERBS: Record<PricingPlanId, string> = {
  free: 'Find',
  player_plus: 'Personalize',
  captain: 'Lead',
  league: 'Run',
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
    cue: 'Use Team tools when lineup week needs one cleaner flow.',
    icon: 'lineupBuilder',
    href: '#captain',
  },
  {
    title: 'Running a league?',
    cue: 'Use League when the season needs structure, standings, and results.',
    icon: 'teamRankings',
    href: '#league',
  },
  {
    title: 'Need fresher data?',
    cue: DATA_ASSIST_STORY.shortCue,
    icon: 'reports',
    href: DATA_ASSIST_STORY.href,
  },
]

const PERSONALIZATION_FLOW: {
  title: string
  cue: string
  icon: TiqFeatureIconName
}[] = [
  {
    title: 'Create free account',
    cue: 'Start Free access. Paid tools unlock only when that plan is active.',
    icon: 'accountSecurity',
  },
  {
    title: 'Connect identity',
    cue: 'Player and higher tiers link your player record once.',
    icon: 'playerRatings',
  },
  {
    title: 'Open your tools',
    cue: 'Open the You, Team, or League workspace that matches your role.',
    icon: 'myLab',
  },
  {
    title: 'Refresh context',
    cue: 'Upload scorecards, schedules, or team summaries through Data Assist when the site needs new tennis data.',
    icon: 'reports',
  },
]

const PLAN_DECISION_HINTS: Record<PricingPlanId, string> = {
  free: 'Look around first',
  player_plus: 'Make it yours',
  captain: 'Run match week',
  league: 'Organize the season',
}

const UNLOCK_PATHS: Array<{
  planId: PricingPlanId
  title: string
  cue: string
  steps: string[]
}> = [
  {
    planId: 'free',
    title: 'Find the landscape',
    cue: 'Use public search until a tennis job becomes personal.',
    steps: ['Search players', 'Open teams or leagues', 'Check rankings'],
  },
  {
    planId: 'player_plus',
    title: 'Make TenAceIQ yours',
    cue: 'Upgrade when profiles, follows, and Prep reads should revolve around your game.',
    steps: ['Link your player', 'Follow what matters', 'Prep matches'],
  },
  {
    planId: 'captain',
    title: 'Run match week',
    cue: 'Upgrade when team decisions need less scattered work.',
    steps: ['Confirm availability', 'Build the lineup', 'Send the plan'],
  },
  {
    planId: 'league',
    title: 'Operate the season',
    cue: 'Upgrade when you need league structure, results, and visibility.',
    steps: ['Set structure', 'Track participants', 'Manage results'],
  },
]

const ENTITLEMENT_CLARITY_STEPS: Array<{
  title: string
  cue: string
  icon: TiqFeatureIconName
}> = [
  {
    title: 'Free starts exploration',
    cue: 'Creating an account opens Free access for public tennis intelligence and Data Assist contributions.',
    icon: 'opponentScouting',
  },
  {
    title: 'Paid tools need activation',
    cue: 'My Lab, Prep insight, Team, and League tools open only after the matching plan is active.',
    icon: 'accountSecurity',
  },
  {
    title: 'Uploads refresh the platform',
    cue: 'New scorecards, rosters, schedules, and corrections move through Data Assist review before they shape TenAceIQ.',
    icon: 'reports',
  },
]

const PLAN_FIT_ROWS: Array<{
  job: string
  free: string
  player_plus: string
  captain: string
  league: string
}> = [
  {
    job: 'Find public tennis context',
    free: 'Included',
    player_plus: 'Included',
    captain: 'Included',
    league: 'Included',
  },
  {
    job: 'Personalize around your game',
    free: '-',
    player_plus: 'Best fit',
    captain: 'Included',
    league: '-',
  },
  {
    job: 'Make weekly team decisions',
    free: '-',
    player_plus: '-',
    captain: 'Best fit',
    league: '-',
  },
  {
    job: 'Run organized league play',
    free: '-',
    player_plus: '-',
    captain: '-',
    league: 'Best fit',
  },
]

const TIME_BACK_MOMENTS: Array<{
  planId: PricingPlanId
  before: string
  after: string
  saved: string
  action: string
}> = [
  {
    planId: 'free',
    before: 'Searching scattered pages just to understand who plays where.',
    after: 'Open the tennis map and get oriented before you commit to a tool.',
    saved: 'Start faster',
    action: 'Search first',
  },
  {
    planId: 'player_plus',
    before: 'Rechecking opponents, old results, and notes before every match.',
    after: 'My Lab keeps your player context, follows, and match prep together.',
    saved: 'Prep clearer',
    action: 'Make it yours',
  },
  {
    planId: 'captain',
    before: 'Text threads, availability guesses, lineup drafts, and last-minute changes.',
    after: 'Team tools turn match week into a clean readiness and lineup flow.',
    saved: 'Win back the week',
    action: 'Lead easier',
  },
  {
    planId: 'league',
    before: 'Spreadsheet cleanup, scorecard chasing, and standings questions.',
    after: 'League keeps structure, results, rankings, and visibility in one place.',
    saved: 'Run cleaner',
    action: 'Operate the season',
  },
]

const PREMIUM_TOOL_SIGNALS: Array<{
  title: string
  cue: string
  icon: TiqFeatureIconName
}> = [
  {
    title: 'Show first',
    cue: 'Every paid tier previews the actual work it unlocks before asking users to decide.',
    icon: 'opponentScouting',
  },
  {
    title: 'Unlock by job',
    cue: 'Users choose Find, You, Team, or League instead of decoding feature bundles.',
    icon: 'accountSecurity',
  },
  {
    title: 'Stay tennis-specific',
    cue: 'The value is fewer lineup guesses, clearer prep, and cleaner results, not generic dashboards.',
    icon: 'lineupBuilder',
  },
]

export default function PricingPage() {
  return (
    <SiteShell active="">
      <PricingContent />
    </SiteShell>
  )
}

function PricingContent() {
  const { role, userId, entitlements, authResolved } = useAuth()
  const resolvedRole = authResolved || !userId ? role : 'member'
  const accessPending = !authResolved
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [resolvedRole, entitlements])
  const recommendedPlan = getPricingPlan(access.recommendedUpgradePlanId ?? access.currentPlanId)
  const currentPlan = getPricingPlan(access.currentPlanId)
  const recommendationLabel = accessPending
    ? 'Checking access'
    : access.currentPlanId === recommendedPlan.id
      ? 'Current access'
      : 'Recommended next'
  const recommendationTitle = accessPending
    ? 'Checking your TenAceIQ access.'
    : access.currentPlanId === recommendedPlan.id
      ? `${currentPlan.name} is active.`
      : `${PLAN_VERBS[recommendedPlan.id]} with ${recommendedPlan.name}.`
  const recommendationText = accessPending
    ? 'We are matching this page to your account before marking a plan active.'
    : access.currentPlanId === recommendedPlan.id
      ? 'You already have the right access for this role. Open the tools that match how you play or lead.'
      : recommendedPlan.outcome

  return (
    <section style={pageWrapStyle}>
        <section style={heroStyle}>
          <div style={eyebrowStyle}>Pricing</div>
          <h1 style={heroTitleStyle}>Choose the tier that clears the next tennis job.</h1>
          <p style={heroTextStyle}>
            Search for free. Upgrade when TenAceIQ needs to become your lab, your lineup desk, or your league operations layer.
          </p>

          <div style={heroActionRowStyle}>
            <Link href={getPlanSignupHref('free')} style={featuredCtaStyle}>
              Start Free
            </Link>
            <a href="#league" style={ctaStyle}>
              See League
            </a>
          </div>

          <div style={proofRowStyle}>
            {PRICING_PROOF_POINTS.map((point) => (
              <span key={point} style={proofPillStyle}>
                {point}
              </span>
            ))}
          </div>
        </section>

        <section style={entitlementClarityBandStyle} aria-label="Account and plan access">
          <div style={entitlementClarityIntroStyle}>
            <div style={sectionEyebrowStyle}>Access clarity</div>
            <h2 style={entitlementClarityTitleStyle}>A free account is the starting line, not a paid unlock.</h2>
            <p style={entitlementClarityTextStyle}>
              Start with Free to find context. Activate Player, Captain, or League when the job needs private tools, role workflows, or league operations.
            </p>
          </div>
          <div style={entitlementClarityGridStyle}>
            {ENTITLEMENT_CLARITY_STEPS.map((step) => (
              <article key={step.title} style={entitlementClarityCardStyle}>
                <TiqFeatureIcon name={step.icon} size="sm" variant="ghost" />
                <span style={entitlementClarityCopyStyle}>
                  <strong>{step.title}</strong>
                  <em>{step.cue}</em>
                </span>
              </article>
            ))}
          </div>
        </section>

        <section style={decisionPathStyle} aria-label="Membership path">
          {PRICING_PLANS.map((plan, index) => {
            const active = !accessPending && isPlanActive(plan.id, access)
            const recommended = !accessPending && !active && (access.recommendedUpgradePlanId === plan.id || plan.badge === 'Most Popular')
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

        <PricingShowcase access={access} accessPending={accessPending} />

        <PremiumValueBand />

        <PlanFitMatrix />

        <section style={unlockPathShellStyle} aria-labelledby="unlock-path-title">
          <div style={unlockPathHeaderStyle}>
            <div>
              <div style={sectionEyebrowStyle}>Unlock path</div>
              <h2 id="unlock-path-title" style={unlockPathTitleStyle}>Move from public context to the right tool.</h2>
            </div>
            <Link href="#player_plus" style={ctaStyle}>
              Start with Player
            </Link>
          </div>

          <div style={unlockPathGridStyle}>
            {UNLOCK_PATHS.map((path) => {
              const plan = getPricingPlan(path.planId)
              return (
                <article key={path.planId} style={unlockPathCardStyle}>
                  <div style={unlockPathCardHeaderStyle}>
                    <TiqFeatureIcon name={PLAN_ICON_BY_ID[path.planId]} size="md" variant="ghost" />
                    <div>
                      <div style={unlockPathPlanStyle}>{plan.name}</div>
                      <h3 style={unlockPathCardTitleStyle}>{path.title}</h3>
                    </div>
                  </div>
                  <p style={unlockPathCueStyle}>{path.cue}</p>
                  <div style={unlockStepListStyle}>
                    {path.steps.map((step, index) => (
                      <span key={step} style={unlockStepPillStyle}>
                        <strong>{index + 1}</strong>
                        {step}
                      </span>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section style={recommendationStripStyle}>
          <TiqFeatureIcon name={PLAN_ICON_BY_ID[recommendedPlan.id]} size="md" variant="surface" />
          <div style={recommendationCopyStyle}>
            <div style={sectionEyebrowStyle}>
              {recommendationLabel}
            </div>
            <h2 style={recommendationTitleStyle}>{recommendationTitle}</h2>
            <p style={recommendationTextStyle}>{recommendationText}</p>
          </div>
          <Link
            href={accessPending ? '#pricing-plans' : getPlanHref(recommendedPlan.id, access.currentPlanId === recommendedPlan.id)}
            style={featuredCtaStyle}
          >
            {accessPending ? 'View tiers' : getPlanCta(recommendedPlan.id, access.currentPlanId === recommendedPlan.id)}
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

        <section id="pricing-plans" style={cardGridStyle}>
          {PRICING_PLANS.map((plan) => {
            const active = !accessPending && isPlanActive(plan.id, access)
            const recommended = !accessPending && (access.recommendedUpgradePlanId === plan.id || plan.badge === 'Most Popular')
            const tier = getMembershipTier(plan.id)
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
                  {!active ? <div style={billingCueStyle}>{getPricingBillingCue(plan.id)}</div> : null}
                  {!active && plan.alternatePriceNote ? <div style={altPriceStyle}>{plan.alternatePriceNote}</div> : null}
                  <div style={cardSubtitleStyle}>{plan.subtitle}</div>
                  <div style={decisionHintStyle}>{PLAN_DECISION_HINTS[plan.id]}</div>
                </div>

                <div style={solutionCardStyle}>
                  <div style={problemLabelStyle}>{active ? 'Your access' : 'Result'}</div>
                  <div style={solutionTextStyle}>{plan.outcome}</div>
                </div>

                <div style={selectionCueGridStyle}>
                  <div style={selectionCueCardStyle}>
                    <div style={problemLabelStyle}>Best for</div>
                    <div style={selectionCueTextStyle}>{tier.audience}</div>
                  </div>
                  <div style={selectionCueCardStyle}>
                    <div style={problemLabelStyle}>Upgrade trigger</div>
                    <div style={selectionCueTextStyle}>{tier.upgradeCue}</div>
                  </div>
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

        <section style={billingPolicyBandStyle} aria-label="Billing policy">
          <div>
            <div style={sectionEyebrowStyle}>Billing clarity</div>
            <h2 style={billingPolicyTitleStyle}>Monthly plans renew until canceled. League covers one season.</h2>
            <p style={billingPolicyTextStyle}>
              Player and Captain are monthly subscriptions. TIQ League Coordinator is the League season fee with standard season limits.
              Refunds are reviewed under the posted billing policy. {SUPPORT_THREAD_ASSURANCE}
            </p>
          </div>
          <div style={billingPolicyActionRowStyle}>
            <Link href="/legal/billing" style={ctaStyle}>
              Billing and refunds
            </Link>
            <Link href={BILLING_SUPPORT_PATH} style={ctaStyle}>
              Open support thread
            </Link>
          </div>
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

        <PricingFinalCta />

    </section>
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
    return getPlanDestinationHref(planId)
  }

  return getPlanSignupHref(planId)
}

function getPlanCta(planId: PricingPlanId, active: boolean) {
  if (active) {
    if (planId === 'captain') return 'Open Team tools'
    if (planId === 'league') return 'Open league desk'
    if (planId === 'player_plus') return 'Personalize My Lab'
    return 'Find players'
  }

  if (planId === 'free') return 'Start free'
  if (planId === 'player_plus') return 'Set up My Lab'
  if (planId === 'captain') return 'Open Team tools'
  return 'Run a league'
}

function PricingShowcase({
  access,
  accessPending,
}: {
  access: ReturnType<typeof buildProductAccessState>
  accessPending: boolean
}) {
  const { isTablet, isMobile } = useViewportBreakpoints()

  return (
    <section
      style={{
        display: 'grid',
        gap: 14,
        padding: isMobile ? 16 : 20,
        borderRadius: 28,
        border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--shell-panel-bg) 88%, var(--brand-green) 12%) 0%, color-mix(in srgb, var(--shell-panel-bg) 94%, var(--brand-blue-2) 6%) 100%)',
        boxShadow: '0 20px 48px rgba(2, 10, 24, 0.12)',
        overflow: 'hidden',
        minWidth: 0,
      }}
      aria-label="Plan preview"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 14,
          alignItems: 'end',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'grid', gap: 6, maxWidth: 760, minWidth: 0 }}>
          <div style={sectionEyebrowStyle}>Show me the tool</div>
          <h2
            style={{
              margin: 0,
              color: 'var(--foreground-strong)',
              fontSize: 'clamp(1.7rem, 3vw, 2.8rem)',
              lineHeight: 1,
              fontWeight: 950,
              letterSpacing: 0,
              overflowWrap: 'anywhere',
            }}
          >
            Each tier opens a familiar tennis workspace.
          </h2>
        </div>
        <Link href="/join" style={featuredCtaStyle}>
          Start Free
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'repeat(4, minmax(0, 1fr))',
          gap: 12,
          minWidth: 0,
        }}
      >
        {PRICING_PLANS.map((plan) => {
          const active = !accessPending && isPlanActive(plan.id, access)
          return (
            <article
              key={plan.id}
              style={{
                display: 'grid',
                gap: 12,
                minHeight: 320,
                padding: 15,
                borderRadius: 20,
                border:
                  plan.id === 'captain'
                    ? '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)'
                    : '1px solid var(--shell-panel-border)',
                background:
                  plan.id === 'captain'
                    ? 'linear-gradient(180deg, color-mix(in srgb, var(--shell-chip-bg) 76%, var(--brand-green) 24%) 0%, var(--shell-chip-bg) 100%)'
                    : 'var(--shell-chip-bg)',
                boxShadow: plan.id === 'captain' ? '0 18px 38px rgba(155,225,29,0.10)' : 'none',
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <TiqFeatureIcon name={PLAN_ICON_BY_ID[plan.id]} size="sm" variant="ghost" />
                <span style={active ? activeBadgeStyle : badgeStyle}>{active ? 'Active' : plan.priceLabel}</span>
              </div>

              <div style={{ display: 'grid', gap: 5 }}>
                <div style={cardPlanStyle}>{plan.name}</div>
                <h3
                  style={{
                    margin: 0,
                    color: 'var(--foreground-strong)',
                    fontSize: 23,
                    lineHeight: 1.02,
                    fontWeight: 950,
                    letterSpacing: 0,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {PLAN_DECISION_HINTS[plan.id]}
                </h3>
              </div>

              <PlanMiniPreview planId={plan.id} />

              <Link
                href={getPlanHref(plan.id, active)}
                style={plan.id === 'captain' ? featuredCtaStyle : ctaStyle}
              >
                {getPlanCta(plan.id, active)}
              </Link>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function PlanMiniPreview({ planId }: { planId: PricingPlanId }) {
  if (planId === 'player_plus') {
    return (
      <div style={miniPreviewShellStyle}>
        <MiniMetric label="TIQ" value="4.48" tone="green" />
        <MiniMetric label="Next edge" value="63%" tone="blue" />
        <MiniRow title="Prep" meta="You vs Rivera" status="Compare" />
        <MiniRow title="Followed" meta="3 teams, 2 leagues" status="Live" />
      </div>
    )
  }

  if (planId === 'captain') {
    return (
      <div style={miniPreviewShellStyle}>
        <MiniMetric label="Available" value="8/10" tone="green" />
        <MiniMetric label="Best lineup" value="71%" tone="green" />
        <MiniRow title="D1" meta="Mei + Brooks" status="Ready" />
        <MiniRow title="Team note" meta="Arrival + lineup" status="Send" />
      </div>
    )
  }

  if (planId === 'league') {
    return (
      <div style={miniPreviewShellStyle}>
        <MiniMetric label="Teams" value="10" tone="blue" />
        <MiniMetric label="Matches" value="36" tone="green" />
        <MiniRow title="Aces" meta="5-1, 16 pts" status="#1" />
        <MiniRow title="Schedule" meta="Sat, Court 3" status="Posted" />
      </div>
    )
  }

  return (
    <div style={miniPreviewShellStyle}>
      <MiniMetric label="Search" value="Free" tone="blue" />
      <MiniMetric label="Data" value="Assist" tone="green" />
      <MiniRow title="Players" meta="Profiles and ratings" status="Open" />
      <MiniRow title="Leagues" meta="Teams and standings" status="Browse" />
    </div>
  )
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: 'green' | 'blue' }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 4,
        padding: 11,
        borderRadius: 14,
        border: tone === 'green' ? '1px solid rgba(155,225,29,0.18)' : '1px solid rgba(116,190,255,0.16)',
        background:
          tone === 'green'
            ? 'color-mix(in srgb, var(--shell-chip-bg) 82%, var(--brand-green) 18%)'
            : 'color-mix(in srgb, var(--shell-chip-bg) 82%, var(--brand-blue-2) 18%)',
      }}
    >
      <span style={{ color: 'var(--shell-copy-muted)', fontSize: 10, fontWeight: 950, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <strong style={{ color: 'var(--foreground-strong)', fontSize: 22, lineHeight: 1, fontWeight: 950 }}>
        {value}
      </strong>
    </div>
  )
}

function MiniRow({ title, meta, status }: { title: string; meta: string; status: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridColumn: '1 / -1',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto)',
        gap: 10,
        alignItems: 'center',
        padding: 10,
        borderRadius: 14,
        border: '1px solid var(--shell-panel-border)',
        background: 'color-mix(in srgb, var(--shell-chip-bg) 86%, var(--surface) 14%)',
        minWidth: 0,
      }}
    >
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <strong style={{ color: 'var(--foreground-strong)', fontSize: 13, fontWeight: 900, overflowWrap: 'anywhere' }}>{title}</strong>
        <em style={{ color: 'var(--shell-copy-muted)', fontSize: 12, fontStyle: 'normal', fontWeight: 700, overflowWrap: 'anywhere' }}>{meta}</em>
      </span>
      <span style={recommendedBadgeStyle}>{status}</span>
    </div>
  )
}

function PremiumValueBand() {
  const { isTablet, isMobile } = useViewportBreakpoints()

  return (
    <section style={premiumValueShellStyle} aria-labelledby="premium-value-title">
      <div style={premiumValueHeaderStyle}>
        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <div style={sectionEyebrowStyle}>Why pay</div>
          <h2 id="premium-value-title" style={premiumValueTitleStyle}>
            Buy back the tennis work that gets in the way of playing.
          </h2>
          <p style={premiumValueTextStyle}>
            The tiers are not just access levels. They are shortcuts for the jobs that take time away from your game, your team, or your league.
          </p>
        </div>
        <div style={premiumSignalGridStyle}>
          {PREMIUM_TOOL_SIGNALS.map((signal) => (
            <div key={signal.title} style={premiumSignalCardStyle}>
              <TiqFeatureIcon name={signal.icon} size="sm" variant="ghost" />
              <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                <strong style={{ color: 'var(--foreground-strong)', fontSize: 13, fontWeight: 950 }}>{signal.title}</strong>
                <em style={{ color: 'var(--shell-copy-muted)', fontSize: 12, lineHeight: 1.35, fontStyle: 'normal', fontWeight: 700 }}>{signal.cue}</em>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'repeat(4, minmax(0, 1fr))',
          gap: 12,
          minWidth: 0,
        }}
      >
        {TIME_BACK_MOMENTS.map((moment) => {
          const plan = getPricingPlan(moment.planId)
          const tier = getMembershipTier(moment.planId)
          const featured = moment.planId === 'captain'
          return (
            <article
              key={moment.planId}
              style={{
                ...timeBackCardStyle,
                ...(featured ? timeBackFeaturedCardStyle : null),
              }}
            >
              <div style={timeBackCardTopStyle}>
                <TiqFeatureIcon name={PLAN_ICON_BY_ID[moment.planId]} size="md" variant={featured ? 'surface' : 'ghost'} />
                <span style={featured ? activeBadgeStyle : badgeStyle}>{plan.priceLabel}</span>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={cardPlanStyle}>{plan.name}</div>
                <h3 style={timeBackCardTitleStyle}>{moment.saved}</h3>
              </div>
              <div style={timeBackCompareStyle}>
                <div style={timeBackBeforeStyle}>
                  <span style={timeBackLabelStyle}>Before</span>
                  {moment.before}
                </div>
                <div style={timeBackAfterStyle}>
                  <span style={timeBackLabelStyle}>With {tier.name}</span>
                  {moment.after}
                </div>
              </div>
              <Link href={getPlanSignupHref(moment.planId)} style={featured ? featuredCtaStyle : ctaStyle}>
                {moment.action}
              </Link>
            </article>
          )
        })}
      </div>

      {isMobile ? null : (
        <div style={premiumFooterStripStyle}>
          <strong>Premium should feel practical:</strong>
          <span>less tab-hopping, fewer texts, clearer next steps, and more time enjoying tennis.</span>
        </div>
      )}
    </section>
  )
}

function PlanFitMatrix() {
  const { isMobile } = useViewportBreakpoints()

  return (
    <section style={fitMatrixShellStyle} aria-labelledby="plan-fit-title">
      <div style={fitMatrixHeaderStyle}>
        <div>
          <div style={sectionEyebrowStyle}>Compare by job</div>
          <h2 id="plan-fit-title" style={fitMatrixTitleStyle}>
            Pick the tier by what you need to do next.
          </h2>
        </div>
        <Link href="#league" style={ctaStyle}>
          League is separate
        </Link>
      </div>

      {isMobile ? (
        <div style={fitMatrixMobileStackStyle}>
          {PLAN_FIT_ROWS.map((row) => (
            <article key={row.job} style={fitMatrixMobileCardStyle}>
              <div style={fitMatrixJobCellStyle}>{row.job}</div>
              <div style={fitMatrixMobilePlanGridStyle}>
                {PRICING_PLANS.map((plan) => {
                  const value = row[plan.id]
                  if (value === '-') return null
                  const best = value === 'Best fit'
                  return (
                    <div
                      key={`${row.job}-${plan.id}`}
                      style={{
                        ...fitMatrixMobilePlanStyle,
                        ...(best ? fitMatrixBestCellStyle : null),
                        ...(plan.id === 'captain' ? fitMatrixCaptainCellStyle : null),
                      }}
                    >
                      <span style={fitMatrixMobilePlanNameStyle}>{plan.name}</span>
                      <span style={best ? fitMatrixPositiveStyle : fitMatrixIncludedStyle}>{value}</span>
                    </div>
                  )
                })}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div style={fitMatrixGridStyle}>
        <div style={fitMatrixHeadCellStyle}>Tennis job</div>
        {PRICING_PLANS.map((plan) => (
          <div
            key={plan.id}
            style={{
              ...fitMatrixHeadCellStyle,
              ...(plan.id === 'captain' ? fitMatrixCaptainHeadStyle : null),
            }}
          >
            {plan.name}
          </div>
        ))}

        {PLAN_FIT_ROWS.map((row) => (
          <Fragment key={row.job}>
            <div key={`${row.job}-job`} style={fitMatrixJobCellStyle}>
              {row.job}
            </div>
            {PRICING_PLANS.map((plan) => {
              const value = row[plan.id]
              const positive = value !== '-'
              const best = value === 'Best fit'
              return (
                <div
                  key={`${row.job}-${plan.id}`}
                  style={{
                    ...fitMatrixCellStyle,
                    ...(plan.id === 'captain' ? fitMatrixCaptainCellStyle : null),
                    ...(best ? fitMatrixBestCellStyle : null),
                  }}
                >
                  <span style={positive ? fitMatrixPositiveStyle : fitMatrixEmptyStyle}>{value}</span>
                </div>
              )
            })}
          </Fragment>
        ))}
        </div>
      )}
    </section>
  )
}

const miniPreviewShellStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  minWidth: 0,
}

const premiumValueShellStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 20,
  borderRadius: 28,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--shell-panel-bg) 86%, var(--brand-green) 14%) 0%, color-mix(in srgb, var(--shell-panel-bg) 94%, var(--brand-blue-2) 6%) 100%)',
  boxShadow: '0 22px 52px rgba(2, 10, 24, 0.14)',
  minWidth: 0,
  overflow: 'hidden',
}

const premiumValueHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
  gap: 16,
  alignItems: 'end',
  minWidth: 0,
}

const premiumValueTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.75rem, 3vw, 3rem)',
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: 0,
  maxWidth: 820,
  overflowWrap: 'anywhere',
}

const premiumValueTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
  fontWeight: 700,
  maxWidth: 760,
}

const premiumSignalGridStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const premiumSignalCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 38px) minmax(0, 1fr)',
  gap: 10,
  alignItems: 'start',
  padding: 11,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 88%, var(--surface) 12%)',
  minWidth: 0,
}

const timeBackCardStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minHeight: 360,
  padding: 15,
  borderRadius: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  minWidth: 0,
}

const timeBackFeaturedCardStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)',
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--shell-chip-bg) 76%, var(--brand-green) 24%) 0%, var(--shell-chip-bg) 100%)',
  boxShadow: '0 18px 38px rgba(155,225,29,0.10)',
}

const timeBackCardTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center',
  minWidth: 0,
}

const timeBackCardTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.02,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const timeBackCompareStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
  minWidth: 0,
}

const timeBackBeforeStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 11,
  borderRadius: 15,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'color-mix(in srgb, var(--surface) 88%, var(--shell-chip-bg) 12%)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 700,
}

const timeBackAfterStyle: CSSProperties = {
  ...timeBackBeforeStyle,
  border: '1px solid color-mix(in srgb, var(--brand-green) 30%, var(--shell-panel-border) 70%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground)',
}

const timeBackLabelStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const premiumFooterStripStyle: CSSProperties = {
  display: 'flex',
  gap: 9,
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: '12px 14px',
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 86%, var(--surface) 14%)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 750,
}

function PricingFinalCta() {
  return (
    <section style={pricingFinalCtaStyle}>
      <div style={{ display: 'grid', gap: 7, maxWidth: 760 }}>
        <div style={sectionEyebrowStyle}>Make the next move</div>
        <h2 style={pricingFinalTitleStyle}>Start with Free, or activate the tier that saves time.</h2>
        <p style={pricingFinalTextStyle}>
          Search the landscape first, then choose the plan that should unlock your personal, captain, or league workspace.
        </p>
      </div>
      <div style={pricingFinalActionStyle}>
        <Link href={getPlanSignupHref('free')} style={featuredCtaStyle}>
          Start Free
        </Link>
        <a href="#captain" style={ctaStyle}>
          Compare Captain
        </a>
        <a href="#league" style={ctaStyle}>
          Compare League
        </a>
      </div>
    </section>
  )
}

const pricingFinalCtaStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
  gap: 16,
  alignItems: 'center',
  padding: 22,
  borderRadius: 28,
  border: '1px solid color-mix(in srgb, var(--brand-green) 26%, var(--shell-panel-border) 74%)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--shell-panel-bg) 90%, var(--brand-green) 10%) 0%, color-mix(in srgb, var(--shell-panel-bg) 96%, var(--brand-blue-2) 4%) 100%)',
  boxShadow: '0 18px 44px rgba(2, 10, 24, 0.10)',
}

const pricingFinalTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.45rem, 2.25vw, 2.25rem)',
  lineHeight: 1.04,
  fontWeight: 950,
  letterSpacing: 0,
}

const pricingFinalTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
  fontWeight: 700,
}

const pricingFinalActionStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  justifyContent: 'flex-end',
  minWidth: 0,
}

const fitMatrixShellStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 26,
  border: '1px solid var(--shell-panel-border)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--shell-panel-bg) 94%, var(--brand-blue-2) 6%) 0%, var(--shell-panel-bg) 100%)',
  boxShadow: '0 16px 38px rgba(2, 10, 24, 0.10)',
  overflowX: 'auto',
  overscrollBehaviorX: 'contain',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'thin',
  maxWidth: '100%',
  minWidth: 0,
}

const fitMatrixHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'end',
  flexWrap: 'wrap',
  minWidth: 0,
}

const fitMatrixTitleStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.35rem, 2vw, 1.9rem)',
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const fitMatrixGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(min(100%, 190px), 1.25fr) repeat(4, minmax(min(100%, 112px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const fitMatrixMobileStackStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const fitMatrixMobileCardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const fitMatrixMobilePlanGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 136px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const fitMatrixMobilePlanStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  minHeight: 62,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 94%, var(--surface) 6%)',
}

const fitMatrixMobilePlanNameStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const fitMatrixHeadCellStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 42,
  padding: '10px 11px',
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const fitMatrixCaptainHeadStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 36%, var(--shell-panel-border) 64%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)',
}

const fitMatrixJobCellStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 46,
  padding: '11px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 88%, var(--surface) 12%)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const fitMatrixCellStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 46,
  padding: '11px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 94%, var(--surface) 6%)',
  display: 'flex',
  alignItems: 'center',
  overflowWrap: 'anywhere',
}

const fitMatrixCaptainCellStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
}

const fitMatrixBestCellStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 42%, var(--shell-panel-border) 58%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

const fitMatrixPositiveStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const fitMatrixIncludedStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const fitMatrixEmptyStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 900,
  opacity: 0.55,
}

const unlockPathShellStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 26,
  border: '1px solid var(--shell-panel-border)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--shell-panel-bg) 92%, var(--brand-green) 8%) 0%, var(--shell-panel-bg) 100%)',
  boxShadow: '0 16px 38px rgba(2, 10, 24, 0.10)',
}

const unlockPathHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'end',
  flexWrap: 'wrap',
  minWidth: 0,
}

const unlockPathTitleStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.35rem, 2vw, 1.9rem)',
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const unlockPathGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 12,
}

const unlockPathCardStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minHeight: 238,
  padding: 16,
  borderRadius: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  minWidth: 0,
}

const unlockPathCardHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 2.75rem) minmax(0, 1fr)',
  gap: 11,
  alignItems: 'center',
  minWidth: 0,
}

const unlockPathPlanStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

const unlockPathCardTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
}

const unlockPathCueStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 700,
}

const unlockStepListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginTop: 'auto',
}

const unlockStepPillStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 24px) minmax(0, 1fr)',
  alignItems: 'center',
  gap: 8,
  minHeight: 34,
  minWidth: 0,
  padding: '5px 9px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'color-mix(in srgb, var(--surface) 88%, var(--shell-chip-bg) 12%)',
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 850,
}

const pageWrapStyle: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(20px, 5vw, 28px)))',
  maxWidth: '100%',
  margin: '0 auto',
  padding: '20px 0 36px',
  display: 'grid',
  gap: 20,
  minWidth: 0,
}

const heroStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 'clamp(20px, 3vw, 28px)',
  borderRadius: 24,
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
  overflowWrap: 'anywhere',
}

const heroTextStyle: CSSProperties = {
  margin: 0,
  maxWidth: 860,
  color: 'var(--shell-copy-muted)',
  fontSize: 16,
  lineHeight: 1.75,
}

const heroActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
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

const entitlementClarityBandStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 14,
  alignItems: 'stretch',
  padding: 18,
  borderRadius: 24,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--shell-panel-bg) 92%, var(--brand-green) 8%) 0%, color-mix(in srgb, var(--shell-panel-bg) 94%, var(--brand-blue-2) 6%) 100%)',
  boxShadow: '0 16px 38px rgba(2, 10, 24, 0.10)',
  minWidth: 0,
}

const entitlementClarityIntroStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'center',
  gap: 8,
  minWidth: 0,
}

const entitlementClarityTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.35rem, 2vw, 1.9rem)',
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const entitlementClarityTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
  fontWeight: 750,
}

const entitlementClarityGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const entitlementClarityCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 2.25rem) minmax(0, 1fr)',
  gap: 10,
  alignItems: 'start',
  padding: 13,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  minWidth: 0,
}

const entitlementClarityCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  color: 'var(--foreground)',
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 900,
}

const decisionPathStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  padding: 12,
  borderRadius: 24,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 14px 34px rgba(2, 10, 24, 0.08)',
}

const decisionStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 28px) minmax(0, 34px) minmax(0, 1fr)',
  alignItems: 'center',
  gap: 10,
  minHeight: 76,
  padding: '12px',
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  minWidth: 0,
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 12,
}

const identityFlowCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 54px) minmax(0, 1fr)',
  alignItems: 'center',
  gap: 12,
  minHeight: 92,
  minWidth: 0,
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 16,
}

const planCardStyle: CSSProperties = {
  display: 'grid',
  gap: 15,
  padding: 22,
  scrollMarginTop: 120,
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
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
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

const billingCueStyle: CSSProperties = {
  color: 'rgba(226,232,240,0.78)',
  fontSize: 12,
  fontWeight: 800,
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

const selectionCueGridStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const selectionCueCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 12,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 92%, var(--surface) 8%)',
}

const selectionCueTextStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 750,
}

const featureListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const featureRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 12px) minmax(0, 1fr)',
  gap: 10,
  alignItems: 'start',
  color: 'var(--foreground)',
  fontSize: 14,
  lineHeight: 1.6,
  minWidth: 0,
}

const featureDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  marginTop: 7,
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
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
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  textDecoration: 'none',
  fontWeight: 900,
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const recommendedHintStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.6,
  fontWeight: 700,
}

const billingPolicyBandStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 16,
  padding: 22,
  borderRadius: 24,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-panel-bg) 92%)',
}

const billingPolicyTitleStyle: CSSProperties = {
  margin: '5px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.12,
  letterSpacing: 0,
}

const billingPolicyTextStyle: CSSProperties = {
  margin: '8px 0 0',
  maxWidth: 800,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
  fontWeight: 750,
}

const billingPolicyActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  maxWidth: '100%',
}

const supportGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
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
  gridTemplateColumns: 'minmax(0, 56px) minmax(0, 1fr)',
  alignItems: 'center',
  gap: 14,
  minHeight: 92,
  padding: 14,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  minWidth: 0,
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
  gridTemplateColumns: 'minmax(0, 42px) minmax(0, 1fr)',
  gap: 12,
  alignItems: 'start',
  minWidth: 0,
}

const stepNumberStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
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
