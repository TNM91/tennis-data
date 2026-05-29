'use client'

import Link from 'next/link'
import { useMemo, type CSSProperties } from 'react'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import { BILLING_SUPPORT_PATH } from '@/lib/billing-policy'
import { getPlanDestinationHref, getPlanSignupHref } from '@/lib/plan-intent'
import { DATA_ASSIST_STORY, getMembershipTier } from '@/lib/product-story'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'
import {
  getPricingBillingCue,
  getPricingPlan,
  PRICING_PLANS,
  type PricingPlanId,
} from '@/lib/pricing-plans'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'

const PLAN_ICON_BY_ID: Record<PricingPlanId, TiqFeatureIconName> = {
  free: 'playerRatings',
  player_plus: 'myLab',
  coach: 'scenarioBuilder',
  captain: 'lineupBuilder',
  league: 'teamRankings',
  full_court: 'teamRankings',
}

const PLAN_PUBLIC_NAMES: Record<PricingPlanId, string> = {
  free: 'Free - Find the tennis landscape',
  player_plus: 'Player - My Lab for your game',
  coach: 'Coach - Coach Hub for player development',
  captain: 'Captain - Team Hub for match week',
  league: 'League - League Office for a season',
  full_court: 'Full-Court - Everything connected, including Tournament Desk',
}

const WORKSPACE_PREVIEWS: Array<{
  planId: PricingPlanId
  title: string
  body: string
  chips: string[]
}> = [
  {
    planId: 'free',
    title: 'Find',
    body: 'Search players, teams, leagues, rankings, tournaments, coaches, and tennis resources before choosing a paid workspace.',
    chips: ['Players', 'Teams', 'Leagues', 'Rankings'],
  },
  {
    planId: 'player_plus',
    title: 'My Lab',
    body: 'Choose a tennis goal, save matchup notes, follow context, and connect scorecards to your own development path.',
    chips: ['Goals', 'Matchup', 'Follows', 'Data Assist'],
  },
  {
    planId: 'coach',
    title: 'Coach Hub',
    body: 'Manage students, plan lessons, assign drills, use Tactical Studio, and keep progress moving between sessions.',
    chips: ['Students', 'Lessons', 'Assignments', 'Evidence'],
  },
  {
    planId: 'captain',
    title: 'Team Hub',
    body: 'Collect availability, scout opponents, build lineups, prepare courts, and send cleaner match-week updates.',
    chips: ['Availability', 'Lineups', 'Scouting', 'Messages'],
  },
  {
    planId: 'league',
    title: 'League Office',
    body: 'Run one bounded league, ladder, or tournament season with structure, schedules, results, standings, and corrections.',
    chips: ['Schedules', 'Results', 'Standings', 'Corrections'],
  },
  {
    planId: 'full_court',
    title: 'Full-Court',
    body: 'Connect My Lab, Coach Hub, Team Hub, League Office, and unlimited Tournament Desk operations from one account.',
    chips: ['My Lab', 'Coach Hub', 'Team Hub', 'Tournament Desk'],
  },
]

const COMPARE_ROWS: Array<{
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
    job: 'Coach players',
    free: '-',
    player_plus: '-',
    coach: 'Best fit',
    captain: '-',
    league: '-',
    full_court: 'Included',
  },
  {
    job: 'Captain match week',
    free: '-',
    player_plus: '-',
    coach: '-',
    captain: 'Best fit',
    league: '-',
    full_court: 'Included',
  },
  {
    job: 'Run a season workspace',
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
    full_court: 'Included',
  },
]

export default function PricingPage() {
  return (
    <SiteShell active="pricing">
      <JsonLd id="pricing-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Pricing', '/pricing')} />
      <PricingContent />
    </SiteShell>
  )
}

function PricingContent() {
  const { role, userId, entitlements, authResolved } = useAuth()
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [resolvedRole, entitlements])
  const recommendedPlanId = access.recommendedUpgradePlanId ?? access.currentPlanId

  return (
    <main style={pageWrapStyle}>
      <section style={heroStyle}>
        <div style={eyebrowStyle}>Pricing</div>
        <h1 style={heroTitleStyle}>Choose your role.</h1>
        <p style={heroTextStyle}>
          Start free, then unlock the workspace that matches your tennis job: My Lab, Coach Hub, Team Hub, League Office, or Full-Court.
        </p>
        <div style={heroActionRowStyle}>
          <Link href={getPlanSignupHref('free')} style={primaryButtonStyle}>Start Free</Link>
          <Link href="#compare" style={secondaryButtonStyle}>Compare what unlocks</Link>
        </div>
      </section>

      <section id="choose" style={sectionStyle} aria-labelledby="choose-title">
        <SectionHeader eyebrow="Choose your role" title="Pick the job you need TenAceIQ to do." body="Each tier is role-based. Free stays useful for discovery; paid plans unlock the workspace behind the work." />
        <div style={planGridStyle}>
          {PRICING_PLANS.map((plan) => {
            const active = isPlanActive(plan.id, access)
            const recommended = !active && recommendedPlanId === plan.id
            const tier = getMembershipTier(plan.id)

            return (
              <article key={plan.id} id={plan.id} style={{ ...planCardStyle, ...(recommended ? recommendedCardStyle : null), ...(active ? activeCardStyle : null) }}>
                <div style={planTopStyle}>
                  <TiqFeatureIcon name={PLAN_ICON_BY_ID[plan.id]} size="lg" variant="surface" />
                  <div style={planBadgeRowStyle}>
                    <span style={planNameStyle}>{PLAN_PUBLIC_NAMES[plan.id]}</span>
                    {recommended ? <span style={badgeStyle}>Recommended</span> : null}
                    {active ? <span style={badgeStyle}>Active</span> : null}
                  </div>
                </div>
                <div style={priceStyle}>{active ? 'Unlocked' : plan.priceLabel}</div>
                {!active ? <div style={billingCueStyle}>{getPricingBillingCue(plan.id)}</div> : null}
                <p style={cardTextStyle}>{plan.outcome}</p>
                <div style={fitBoxStyle}>
                  <strong>Best for</strong>
                  <span>{tier.audience}</span>
                </div>
                <ul style={featureListStyle}>
                  {plan.valueProps.slice(0, 3).map((valueProp) => (
                    <li key={valueProp}>{valueProp}</li>
                  ))}
                </ul>
                <Link href={getPlanHref(plan.id, active)} style={plan.id === 'captain' ? primaryButtonStyle : secondaryButtonStyle}>
                  {getPlanCta(plan.id, active)}
                </Link>
              </article>
            )
          })}
        </div>
      </section>

      <section id="workspace" style={sectionStyle} aria-labelledby="workspace-title">
        <SectionHeader eyebrow="See the workspace" title="Know what opens before you upgrade." body="TenAceIQ pricing is easier when the workspace names match the tennis work." />
        <div style={workspaceGridStyle}>
          {WORKSPACE_PREVIEWS.map((preview) => (
            <article key={preview.planId} style={workspaceCardStyle}>
              <span style={workspaceLabelStyle}>{getPricingPlan(preview.planId).name}</span>
              <h2 style={workspaceTitleStyle}>{preview.title}</h2>
              <p style={cardTextStyle}>{preview.body}</p>
              <div style={chipRowStyle}>
                {preview.chips.map((chip) => <span key={chip} style={chipStyle}>{chip}</span>)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="compare" style={sectionStyle} aria-labelledby="compare-title">
        <SectionHeader eyebrow="Compare what unlocks" title="Compare by tennis job, not feature noise." body="Full-Court includes all focused workspaces and unlimited Tournament Desk operations." />
        <div style={tableWrapStyle}>
          <table style={compareTableStyle}>
            <thead>
              <tr>
                <th style={tableHeadStyle}>Job</th>
                <th style={tableHeadStyle}>Free</th>
                <th style={tableHeadStyle}>Player</th>
                <th style={tableHeadStyle}>Coach</th>
                <th style={tableHeadStyle}>Captain</th>
                <th style={tableHeadStyle}>League</th>
                <th style={tableHeadStyle}>Full-Court</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.job}>
                  <td style={tableJobStyle}>{row.job}</td>
                  <CompareCell value={row.free} />
                  <CompareCell value={row.player_plus} />
                  <CompareCell value={row.coach} />
                  <CompareCell value={row.captain} />
                  <CompareCell value={row.league} />
                  <CompareCell value={row.full_court} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="billing" style={billingBandStyle} aria-label="Billing clarity">
        <div>
          <div style={sectionEyebrowStyle}>Billing clarity</div>
          <h2 style={billingTitleStyle}>Monthly plans renew until canceled. League is a season workspace fee.</h2>
          <p style={heroTextStyle}>
            Player, Coach, Captain, and Full-Court are monthly subscriptions. League is $14.99 per season workspace for one bounded league, ladder, or tournament season.
          </p>
          <p style={smallTextStyle}>{DATA_ASSIST_STORY.shortCue}</p>
        </div>
        <div style={heroActionRowStyle}>
          <Link href="/legal/billing" style={secondaryButtonStyle}>Billing and refunds</Link>
          <Link href={BILLING_SUPPORT_PATH} style={secondaryButtonStyle}>Open support thread</Link>
        </div>
      </section>

      <section id="start" style={finalCtaStyle}>
        <div>
          <div style={sectionEyebrowStyle}>Start free / upgrade</div>
          <h2 style={billingTitleStyle}>Find first. Upgrade when the tennis work gets specific.</h2>
          <p style={heroTextStyle}>Search the tennis landscape for free, then open the role workspace that saves your week.</p>
        </div>
        <div style={heroActionRowStyle}>
          <Link href={getPlanSignupHref('free')} style={primaryButtonStyle}>Start Free</Link>
          <Link href={getPlanSignupHref(recommendedPlanId)} style={secondaryButtonStyle}>Upgrade</Link>
        </div>
      </section>
    </main>
  )
}

function CompareCell({ value }: { value: string }) {
  return <td style={value === '-' ? tableMutedCellStyle : tableCellStyle}>{value}</td>
}

function SectionHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div style={sectionHeaderStyle}>
      <div style={sectionEyebrowStyle}>{eyebrow}</div>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <p style={sectionBodyStyle}>{body}</p>
    </div>
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

function getPlanHref(planId: PricingPlanId, active: boolean) {
  return active ? getPlanDestinationHref(planId) : getPlanSignupHref(planId)
}

function getPlanCta(planId: PricingPlanId, active: boolean) {
  if (active) {
    if (planId === 'coach') return 'Open Coach Hub'
    if (planId === 'captain') return 'Open Team Hub'
    if (planId === 'league') return 'Open League Office'
    if (planId === 'full_court') return 'Open Full-Court'
    if (planId === 'player_plus') return 'Open My Lab'
    return 'Find Tennis'
  }

  if (planId === 'free') return 'Start free'
  if (planId === 'player_plus') return 'Unlock Player'
  if (planId === 'coach') return 'Unlock Coach'
  if (planId === 'captain') return 'Unlock Captain'
  if (planId === 'league') return 'Unlock League'
  return 'Unlock Full-Court'
}

const pageWrapStyle: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(20px, 5vw, 28px)))',
  margin: '0 auto',
  padding: '20px 0 42px',
  display: 'grid',
  gap: 22,
  minWidth: 0,
  color: 'var(--foreground)',
}

const heroStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 'clamp(22px, 4vw, 34px)',
  borderRadius: 26,
  border: '1px solid rgba(125, 211, 252, 0.22)',
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(7,20,40,0.88))',
  boxShadow: '0 24px 70px rgba(2, 8, 23, 0.42)',
}

const eyebrowStyle: CSSProperties = {
  width: 'fit-content',
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const heroTitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: 900,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2.7rem, 6vw, 5.3rem)',
  lineHeight: 0.95,
  fontWeight: 950,
  letterSpacing: 0,
}

const heroTextStyle: CSSProperties = {
  margin: 0,
  maxWidth: 860,
  color: 'var(--shell-copy-muted)',
  fontSize: 16,
  lineHeight: 1.75,
  fontWeight: 700,
}

const heroActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 46,
  padding: '0 16px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'linear-gradient(180deg, #eaff9e 0%, #9be11d 100%)',
  color: '#071226',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 950,
}

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: 'rgba(7,17,33,0.72)',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(116,190,255,0.16)',
}

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
}

const sectionHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  maxWidth: 860,
}

const sectionEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.65rem, 3vw, 2.5rem)',
  lineHeight: 1.06,
  fontWeight: 950,
  letterSpacing: 0,
}

const sectionBodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 15,
  lineHeight: 1.7,
  fontWeight: 700,
}

const planGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const planCardStyle: CSSProperties = {
  display: 'grid',
  gap: 13,
  alignContent: 'start',
  padding: 20,
  borderRadius: 24,
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.70)',
  boxShadow: '0 18px 44px rgba(2, 10, 24, 0.16)',
  minWidth: 0,
  overflowWrap: 'anywhere',
  scrollMarginTop: 120,
}

const recommendedCardStyle: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.36)',
  background: 'linear-gradient(180deg, rgba(155,225,29,0.10), rgba(8, 13, 28, 0.72))',
}

const activeCardStyle: CSSProperties = {
  border: '1px solid rgba(116,190,255,0.36)',
}

const planTopStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
}

const planBadgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
}

const planNameStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 950,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 26,
  padding: '0 9px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.32)',
  background: 'rgba(155,225,29,0.12)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 950,
}

const priceStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 32,
  lineHeight: 1,
  fontWeight: 950,
}

const billingCueStyle: CSSProperties = {
  color: 'rgba(226,232,240,0.78)',
  fontSize: 12,
  fontWeight: 850,
}

const cardTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
  fontWeight: 700,
}

const fitBoxStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(15,23,42,0.58)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
}

const featureListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: 'var(--foreground)',
  fontSize: 14,
  lineHeight: 1.6,
  fontWeight: 700,
}

const workspaceGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 14,
}

const workspaceCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minHeight: 220,
  padding: 18,
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(8,16,34,0.74)',
}

const workspaceLabelStyle: CSSProperties = {
  width: 'fit-content',
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const workspaceTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 25,
  lineHeight: 1.1,
  fontWeight: 950,
}

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  marginTop: 'auto',
}

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 9px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 900,
}

const tableWrapStyle: CSSProperties = {
  overflowX: 'auto',
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(8,16,34,0.74)',
}

const compareTableStyle: CSSProperties = {
  width: '100%',
  minWidth: 820,
  borderCollapse: 'collapse',
}

const tableHeadStyle: CSSProperties = {
  padding: 13,
  textAlign: 'left',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '1px solid rgba(116,190,255,0.13)',
}

const tableJobStyle: CSSProperties = {
  padding: 13,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  borderBottom: '1px solid rgba(116,190,255,0.09)',
}

const tableCellStyle: CSSProperties = {
  padding: 13,
  color: 'var(--foreground)',
  fontWeight: 800,
  borderBottom: '1px solid rgba(116,190,255,0.09)',
}

const tableMutedCellStyle: CSSProperties = {
  ...tableCellStyle,
  color: 'rgba(226,232,240,0.38)',
}

const billingBandStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 16,
  alignItems: 'center',
  padding: 22,
  borderRadius: 24,
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'rgba(155,225,29,0.08)',
}

const billingTitleStyle: CSSProperties = {
  margin: '6px 0 8px',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.45rem, 2.8vw, 2.2rem)',
  lineHeight: 1.08,
  fontWeight: 950,
}

const smallTextStyle: CSSProperties = {
  margin: '8px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 750,
}

const finalCtaStyle: CSSProperties = {
  ...billingBandStyle,
  background: 'linear-gradient(135deg, rgba(155,225,29,0.12), rgba(116,190,255,0.08))',
}
