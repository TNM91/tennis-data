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
  coach: 'scenarioBuilder',
  captain: 'lineupBuilder',
  league: 'teamRankings',
  full_court: 'teamRankings',
}

const PLAN_VERBS: Record<PricingPlanId, string> = {
  free: 'Find',
  player_plus: 'Personalize',
  coach: 'Coach',
  captain: 'Lead',
  league: 'Run',
  full_court: 'Own',
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
    title: 'Coaching players?',
    cue: 'Use Coach when lessons, assignments, scheduling, and student tracking need one workspace.',
    icon: 'scenarioBuilder',
    href: '#coach',
  },
  {
    title: 'Making decisions?',
    cue: 'Use Captain when lineup week needs one cleaner flow.',
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
    cue: 'Start Free access. Paid workspaces open only when that plan is active.',
    icon: 'accountSecurity',
  },
  {
    title: 'Set profile',
    cue: 'Players can choose a record or create a self-rated starting point.',
    icon: 'playerRatings',
  },
  {
    title: 'Open your workspace',
    cue: 'Open the You, Coach, Team, or League workspace that matches your role.',
    icon: 'myLab',
  },
  {
    title: 'Refresh context',
    cue: 'Upload scorecards, schedules, or team summaries through Improve data when the site needs new tennis context.',
    icon: 'reports',
  },
]

const PLAN_DECISION_HINTS: Record<PricingPlanId, string> = {
  free: 'Look around first',
  player_plus: 'Make it yours',
  coach: 'Develop players',
  captain: 'Run match week',
  league: 'Organize the season',
  full_court: 'Unlock the suite',
}

const CORE_PRICING_PLANS = PRICING_PLANS.filter((plan) => plan.id !== 'full_court')
const FULL_COURT_PLAN = getPricingPlan('full_court')

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
    cue: 'Upgrade when My Lab, data refreshes, Matchup, and Messages should revolve around your game.',
    steps: ['Open My Lab', 'Improve data', 'Prep matchup'],
  },
  {
    planId: 'coach',
    title: 'Develop players',
    cue: 'Upgrade when lessons, students, drill assignments, and scheduling need one connected flow.',
    steps: ['Plan lessons', 'Assign drills', 'Track students'],
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
  {
    planId: 'full_court',
    title: 'Run the full court',
    cue: 'Upgrade when Coach, Captain, League, and unlimited tournaments should live together.',
    steps: ['Open the suite', 'Coach and lead', 'Track teams and results'],
  },
]

const ENTITLEMENT_CLARITY_STEPS: Array<{
  title: string
  cue: string
  icon: TiqFeatureIconName
}> = [
  {
    title: 'Free starts exploration',
    cue: 'Creating an account opens Free access for public tennis intelligence and data contributions.',
    icon: 'opponentScouting',
  },
  {
    title: 'Paid workspaces need activation',
    cue: 'My Lab, Prep insight, Team, League, and Full-Court open only after the matching plan is active.',
    icon: 'accountSecurity',
  },
  {
    title: 'Uploads refresh the platform',
    cue: 'New scorecards, rosters, schedules, and corrections move through review before they shape TenAceIQ.',
    icon: 'reports',
  },
]

const PLAN_FIT_ROWS: Array<{
  job: string
  free: string
  player_plus: string
  coach: string
  captain: string
  league: string
  full_court: string
}> = [
  {
    job: 'Find public tennis context',
    free: 'Included',
    player_plus: 'Included',
    coach: 'Included',
    captain: 'Included',
    league: 'Included',
    full_court: 'Included',
  },
  {
    job: 'Personalize around your game',
    free: '-',
    player_plus: 'Best fit',
    coach: 'Included',
    captain: 'Included',
    league: '-',
    full_court: 'Included',
  },
  {
    job: 'Coach players and assign drills',
    free: '-',
    player_plus: '-',
    coach: 'Best fit',
    captain: '-',
    league: '-',
    full_court: 'Included',
  },
  {
    job: 'Make weekly team decisions',
    free: '-',
    player_plus: '-',
    coach: '-',
    captain: 'Best fit',
    league: '-',
    full_court: 'Included',
  },
  {
    job: 'Run organized league play',
    free: '-',
    player_plus: '-',
    coach: '-',
    captain: '-',
    league: 'Best fit',
    full_court: 'Included',
  },
  {
    job: 'Run unlimited tournaments',
    free: '-',
    player_plus: '-',
    coach: '-',
    captain: '-',
    league: '-',
    full_court: 'Best fit',
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
    after: 'Open the tennis map and get oriented before you commit to a paid workspace.',
    saved: 'Start faster',
    action: 'Search first',
  },
  {
    planId: 'player_plus',
    before: 'Rechecking opponents, old results, and notes before every match.',
    after: 'My Lab keeps your player context, data refreshes, match prep, and messages together.',
    saved: 'Prep clearer',
    action: 'Make it yours',
  },
  {
    planId: 'coach',
    before: 'Lesson notes, drill ideas, player homework, scheduling, and follow-up messages spread everywhere.',
    after: 'Coach keeps students, lesson plans, Tactical Studio boards, assignments, check-ins, and messages in one lane.',
    saved: 'Develop cleaner',
    action: 'Coach smarter',
  },
  {
    planId: 'captain',
    before: 'Text threads, availability guesses, lineup drafts, and last-minute changes.',
    after: 'Captain turns match week into a clean readiness and lineup flow.',
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
  {
    planId: 'full_court',
    before: 'Coaching, captain work, league operations, and tournaments split across different systems.',
    after: 'Full-Court keeps every TenAceIQ workspace in one tennis operation.',
    saved: 'Run everything',
    action: 'Unlock the suite',
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
    cue: 'Users choose Find, You, Coach, Team, or League instead of decoding feature bundles.',
    icon: 'accountSecurity',
  },
  {
    title: 'Stay tennis-specific',
    cue: 'The value is fewer lineup guesses, clearer prep, and cleaner results, not generic dashboards.',
    icon: 'lineupBuilder',
  },
]

const ROLE_FIT_CARDS: Array<{
  planId: PricingPlanId
  title: string
  bestFor: string
  includes: string[]
  notFor: string
  cta: string
  href: string
}> = [
  {
    planId: 'coach',
    title: 'Coach',
    bestFor: 'Private lessons, school coaches, clinics, training groups, and player development follow-through.',
    includes: ['Student tracking', 'Lesson planning', 'Drill assignments', 'Tactical Studio', 'Coach-player messages'],
    notFor: 'Weekly team lineup management, availability, and match-week captain decisions.',
    cta: 'See Coach',
    href: '#coach',
  },
  {
    planId: 'captain',
    title: 'Captain',
    bestFor: 'Team leadership, weekly lineup decisions, availability, scouting, readiness, and team communication.',
    includes: ['Lineup tools', 'Availability', 'Team scouting', 'Practice planning', 'Captain messaging'],
    notFor: 'Private lesson student tracking and player homework workflows.',
    cta: 'See Captain',
    href: '#captain',
  },
  {
    planId: 'full_court',
    title: 'Full-Court',
    bestFor: 'Users who coach players, lead teams, and run leagues or events from one account.',
    includes: ['Player', 'Coach', 'Captain', 'League', 'Unlimited tournaments'],
    notFor: 'Someone who only needs one focused workspace.',
    cta: 'See Full-Court',
    href: '#full_court',
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
      ? 'You already have the right access for this role. Open the workspace that matches how you play or lead.'
      : recommendedPlan.outcome

  return (
    <section style={pageWrapStyle}>
        <section style={heroStyle}>
          <span aria-hidden="true" style={watermarkStyle} />
          <div style={eyebrowStyle}>Pricing</div>
          <h1 style={heroTitleStyle}>Choose your lane.</h1>
          <p style={heroTextStyle}>
            Find is free. Player, Coach, Captain, League, and Full-Court unlock the workspace behind the job.
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
            <h2 style={entitlementClarityTitleStyle}>Find first. Unlock when it matters.</h2>
            <p style={entitlementClarityTextStyle}>
              Search the map for free. Upgrade when the work needs your profile, team, league, or full tennis desk.
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

        <RoleFitGuide />

        <section style={unlockPathShellStyle} aria-labelledby="unlock-path-title">
          <div style={unlockPathHeaderStyle}>
            <div>
              <div style={sectionEyebrowStyle}>Unlock path</div>
              <h2 id="unlock-path-title" style={unlockPathTitleStyle}>What opens next.</h2>
            </div>
            <Link href="#player_plus" style={ctaStyle}>
              Player lane
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
              <h2 style={identityBridgeTitleStyle}>Player workspaces start by knowing who you are.</h2>
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
          {CORE_PRICING_PLANS.map((plan) => {
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

        <FullCourtPricingSuite access={access} accessPending={accessPending} />

        <section style={billingPolicyBandStyle} aria-label="Billing policy">
          <div>
            <div style={sectionEyebrowStyle}>Billing clarity</div>
            <h2 style={billingPolicyTitleStyle}>Monthly plans renew until canceled. League covers one season.</h2>
            <p style={billingPolicyTextStyle}>
              Player, Coach, and Captain are monthly subscriptions. TIQ League Coordinator is the League season fee with standard season limits.
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
            <div style={sectionEyebrowStyle}>By job</div>
            <h2 style={sectionTitleStyle}>Match the plan to the work.</h2>
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
            <h2 style={sectionTitleStyle}>Open, use, upgrade.</h2>
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
                          : 'Add deeper insight or team workflows when you need them.'}
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
  if (planId === 'coach') return access.canUseCoachWorkflow
  if (planId === 'captain') return access.canUseCaptainWorkflow
  if (planId === 'league') return access.canUseLeagueTools
  return access.currentPlanId === 'full_court'
}

function FullCourtPricingSuite({
  access,
  accessPending,
}: {
  access: ReturnType<typeof buildProductAccessState>
  accessPending: boolean
}) {
  const active = !accessPending && isPlanActive('full_court', access)
  const tier = getMembershipTier('full_court')
  const suiteItems = [
    'Find',
    'Player',
    'Coach',
    'Team',
    'League',
    'Unlimited tournaments',
    'Awards',
  ]

  return (
    <section id="full_court" style={fullCourtSuiteStyle}>
      <div style={fullCourtSuiteHeaderStyle}>
        <div style={fullCourtSuiteCopyStyle}>
          <div style={fullCourtBadgeRowStyle}>
            <span style={fullCourtFeaturedBadgeStyle}>Championship suite</span>
            <span style={sectionEyebrowStyle}>Full suite</span>
          </div>
          <h2 style={fullCourtSuiteTitleStyle}>Run the full tennis operation.</h2>
          <div style={fullCourtValueStripStyle}>
            {suiteItems.map((item) => (
              <span key={item} style={fullCourtValueChipStyle}>{item}</span>
            ))}
          </div>
        </div>
        <div style={fullCourtSuitePriceStyle}>
          <span style={cardPlanStyle}>{FULL_COURT_PLAN.name}</span>
          <strong>{active ? 'Unlocked' : FULL_COURT_PLAN.priceLabel}</strong>
          {!active ? <em>{getPricingBillingCue('full_court')}</em> : <em>Access active</em>}
        </div>
      </div>

      <div style={fullCourtSuiteFooterStyle}>
        <div style={recommendedHintStyle}>{tier.upgradeCue} Everything above, plus unlimited tournament and league operations.</div>
        <Link href={getPlanHref('full_court', active)} style={fullCourtPrimaryCtaStyle}>
          {getPlanCta('full_court', active)}
        </Link>
      </div>
    </section>
  )
}

function getPlanHref(planId: PricingPlanId, active: boolean) {
  if (active) {
    return getPlanDestinationHref(planId)
  }

  return getPlanSignupHref(planId)
}

function getPlanCta(planId: PricingPlanId, active: boolean) {
  if (active) {
    if (planId === 'full_court') return 'Open Full-Court'
    if (planId === 'coach') return 'Open Coach'
    if (planId === 'captain') return 'Open Captain'
    if (planId === 'league') return 'Open league desk'
    if (planId === 'player_plus') return 'Personalize My Lab'
    return 'Find players'
  }

  if (planId === 'free') return 'Start free'
  if (planId === 'player_plus') return 'Set up My Lab'
  if (planId === 'coach') return 'Unlock Coach'
  if (planId === 'captain') return 'Unlock Captain'
  if (planId === 'full_court') return 'Unlock Full-Court'
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
          <div style={sectionEyebrowStyle}>Show me the workspace</div>
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
        border: '1px solid rgba(125, 211, 252, 0.16)',
        background: 'rgba(15, 23, 42, 0.62)',
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
            The tiers are not just access levels. They are workspaces for the jobs that take time away from your game, your team, or your league.
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
                        ...(plan.id === 'coach' ? fitMatrixCoachCellStyle : null),
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
              ...(plan.id === 'coach' ? fitMatrixCoachHeadStyle : null),
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
                    ...(plan.id === 'coach' ? fitMatrixCoachCellStyle : null),
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

function RoleFitGuide() {
  return (
    <section style={roleFitShellStyle} aria-labelledby="role-fit-title">
      <div style={roleFitHeaderStyle}>
        <div>
          <div style={sectionEyebrowStyle}>Coach, Captain, or Full-Court</div>
          <h2 id="role-fit-title" style={fitMatrixTitleStyle}>
            Pick the role by the work, not the title.
          </h2>
        </div>
        <p style={roleFitIntroStyle}>
          A school coach might need Coach for development and Captain for match week. Full-Court unlocks both, plus League and tournaments.
        </p>
      </div>
      <div style={roleFitGridStyle}>
        {ROLE_FIT_CARDS.map((card) => {
          const plan = getPricingPlan(card.planId)
          return (
            <article key={card.planId} style={roleFitCardStyle(card.planId)}>
              <div style={roleFitTopStyle}>
                <TiqFeatureIcon name={PLAN_ICON_BY_ID[card.planId]} size="md" variant="ghost" />
                <span style={cardPlanStyle}>{plan.priceLabel}</span>
              </div>
              <h3 style={roleFitTitleStyle}>{card.title}</h3>
              <p style={roleFitTextStyle}>{card.bestFor}</p>
              <div style={roleFitChipRowStyle}>
                {card.includes.map((item) => (
                  <span key={item} style={roleFitChipStyle}>{item}</span>
                ))}
              </div>
              <div style={roleFitNotForStyle}>
                <strong>Not mainly for:</strong>
                <span>{card.notFor}</span>
              </div>
              <Link href={card.href} style={card.planId === 'full_court' ? fullCourtPrimaryCtaStyle : ctaStyle}>
                {card.cta}
              </Link>
            </article>
          )
        })}
      </div>
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
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.12), rgba(34,211,238,0.08))',
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
  background: 'rgba(15, 23, 42, 0.62)',
  minWidth: 0,
}

const timeBackCardStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minHeight: 360,
  padding: 15,
  borderRadius: 20,
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  minWidth: 0,
}

const timeBackFeaturedCardStyle: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.42)',
  background: 'linear-gradient(180deg, rgba(155,225,29,0.18), rgba(15,23,42,0.66))',
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
  background: 'rgba(8, 13, 28, 0.58)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 700,
}

const timeBackAfterStyle: CSSProperties = {
  ...timeBackBeforeStyle,
  border: '1px solid rgba(155,225,29,0.3)',
  background: 'rgba(155,225,29,0.1)',
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
  background: 'rgba(15, 23, 42, 0.62)',
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
        <h2 style={pricingFinalTitleStyle}>Find free. Unlock the lane.</h2>
        <p style={pricingFinalTextStyle}>
          Player for your game. Captain for the week. League for the season. Full-Court for all of it.
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
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.1), rgba(34,211,238,0.08))',
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
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.66)',
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
  gridTemplateColumns: 'minmax(min(100%, 190px), 1.25fr) repeat(6, minmax(min(100%, 112px), 1fr))',
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
  background: 'rgba(15, 23, 42, 0.62)',
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
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const fitMatrixCaptainHeadStyle: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.36)',
  background: 'rgba(155,225,29,0.12)',
}

const fitMatrixCoachHeadStyle: CSSProperties = {
  border: '1px solid rgba(125,211,252,0.34)',
  background: 'rgba(125,211,252,0.10)',
}

const fitMatrixJobCellStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 46,
  padding: '11px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(15, 23, 42, 0.62)',
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
  background: 'rgba(15, 23, 42, 0.62)',
  display: 'flex',
  alignItems: 'center',
  overflowWrap: 'anywhere',
}

const fitMatrixCaptainCellStyle: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'rgba(155,225,29,0.08)',
}

const fitMatrixCoachCellStyle: CSSProperties = {
  border: '1px solid rgba(125,211,252,0.22)',
  background: 'rgba(125,211,252,0.07)',
}

const fitMatrixBestCellStyle: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.42)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

const roleFitShellStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 18,
  borderRadius: 28,
  border: '1px solid rgba(155,225,29,0.20)',
  background:
    'radial-gradient(circle at 8% 0%, rgba(125,211,252,0.14), transparent 32%), linear-gradient(135deg, rgba(8,13,28,0.82), rgba(8,13,28,0.66))',
  boxShadow: '0 18px 44px rgba(2, 10, 24, 0.14)',
  minWidth: 0,
}

const roleFitHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 16,
  alignItems: 'end',
  minWidth: 0,
}

const roleFitIntroStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 760,
  minWidth: 0,
}

const roleFitGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 12,
  minWidth: 0,
}

function roleFitCardStyle(planId: PricingPlanId): CSSProperties {
  const isFullCourt = planId === 'full_court'
  const isCoach = planId === 'coach'
  return {
    display: 'grid',
    alignContent: 'start',
    gap: 12,
    padding: 16,
    borderRadius: 22,
    border: isFullCourt
      ? '1px solid rgba(155,225,29,0.34)'
      : isCoach
        ? '1px solid rgba(125,211,252,0.28)'
        : '1px solid rgba(155,225,29,0.22)',
    background: isFullCourt
      ? 'linear-gradient(145deg, rgba(155,225,29,0.13), rgba(15,23,42,0.70))'
      : isCoach
        ? 'linear-gradient(145deg, rgba(125,211,252,0.10), rgba(15,23,42,0.66))'
        : 'linear-gradient(145deg, rgba(155,225,29,0.09), rgba(15,23,42,0.66))',
    minWidth: 0,
  }
}

const roleFitTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
}

const roleFitTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
}

const roleFitTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.5,
  fontWeight: 760,
}

const roleFitChipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  minWidth: 0,
}

const roleFitChipStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--foreground-strong)',
  padding: '5px 8px',
  fontSize: 11,
  fontWeight: 900,
}

const roleFitNotForStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 11,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.42,
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
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.66)',
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
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
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
  background: 'rgba(8, 13, 28, 0.58)',
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
  boxSizing: 'border-box',
  overflowX: 'clip',
}

const heroStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 14,
  padding: 'clamp(20px, 3vw, 28px)',
  borderRadius: 24,
  overflow: 'hidden',
  border: '1px solid rgba(125, 211, 252, 0.22)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2, 8, 23, 0.48)',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-110px',
  top: '-118px',
  width: 310,
  height: 310,
  borderRadius: '50%',
  pointerEvents: 'none',
  opacity: 0.16,
  background:
    'radial-gradient(circle at 36% 34%, rgba(255,255,255,0.88) 0 7%, transparent 8%), radial-gradient(circle at 50% 50%, rgba(155,225,29,0.96) 0 48%, rgba(155,225,29,0.1) 49%, transparent 58%)',
  boxShadow: '0 0 80px rgba(155,225,29,0.22)',
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
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(15, 23, 42, 0.66)',
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
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.1), rgba(34,211,238,0.08))',
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
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(15, 23, 42, 0.66)',
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
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.66)',
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
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  minWidth: 0,
}

const decisionStepActiveStyle: CSSProperties = {
  border: '1px solid rgba(125, 211, 252, 0.34)',
  background: 'rgba(56,189,248,0.1)',
}

const decisionStepRecommendedStyle: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.36)',
  background: 'rgba(155,225,29,0.1)',
}

const decisionNumberStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 28,
  height: 28,
  borderRadius: 999,
  border: '1px solid rgba(125, 211, 252, 0.16)',
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
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'rgba(155,225,29,0.08)',
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
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.66)',
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
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
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

const fullCourtSuiteStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 14,
  minWidth: 0,
  scrollMarginTop: 120,
  overflow: 'hidden',
  padding: 20,
  borderRadius: 24,
  border: '1px solid rgba(155,225,29,0.42)',
  background:
    'linear-gradient(135deg, rgba(155,225,29,0.16) 0%, rgba(14,35,57,0.94) 34%, rgba(8,13,28,0.98) 100%)',
  boxShadow: '0 32px 88px rgba(2,8,23,0.44), 0 0 0 1px rgba(116,190,255,0.08) inset',
}

const fullCourtSuiteHeaderStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 16,
  alignItems: 'center',
  minWidth: 0,
}

const fullCourtSuiteCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const fullCourtBadgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 9,
  alignItems: 'center',
  minWidth: 0,
}

const fullCourtFeaturedBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 11px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.42)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.22), rgba(116,190,255,0.12))',
  color: 'var(--foreground-strong)',
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const fullCourtSuiteTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.85rem, 3.4vw, 2.75rem)',
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const fullCourtValueStripStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const fullCourtValueChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(15,23,42,0.45)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 900,
}

const fullCourtSuitePriceStyle: CSSProperties = {
  justifySelf: 'end',
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: '14px 16px',
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'rgba(15,23,42,0.55)',
  textAlign: 'right',
  color: 'var(--foreground-strong)',
}

const fullCourtSuiteFooterStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
  justifyContent: 'space-between',
  minWidth: 0,
}

const fullCourtPrimaryCtaStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 46,
  padding: '0 18px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.42)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.32), rgba(116,190,255,0.18))',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 950,
  boxShadow: '0 18px 40px rgba(155,225,29,0.14)',
}

const planCardStyle: CSSProperties = {
  display: 'grid',
  gap: 15,
  padding: 22,
  scrollMarginTop: 120,
  borderRadius: 28,
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.66)',
  boxShadow: '0 18px 44px rgba(2, 10, 24, 0.12)',
}

const recommendedCardStyle: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.34)',
}

const featuredCardStyle: CSSProperties = {
  border: '1px solid rgba(155, 225, 29, 0.24)',
  background: 'linear-gradient(180deg, rgba(155,225,29,0.12), rgba(34,211,238,0.06))',
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
  background: 'rgba(155,225,29,0.16)',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(155,225,29,0.38)',
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
  background: 'rgba(155,225,29,0.14)',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(155,225,29,0.3)',
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
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
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
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
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
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
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
  background: 'rgba(155,225,29,0.34)',
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
  background: 'rgba(15, 23, 42, 0.66)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  fontWeight: 900,
}

const featuredCtaStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: 999,
  background: 'linear-gradient(135deg, rgba(155,225,29,0.32), rgba(34,211,238,0.16))',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(155,225,29,0.38)',
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
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'rgba(155,225,29,0.08)',
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
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.66)',
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
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
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
  background: 'rgba(155,225,29,0.22)',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(155,225,29,0.38)',
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
