'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import NavLockIcon from '@/app/components/nav-lock-icon'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import {
  badgeBlue,
  badgeGreen,
  badgeSlate,
  buttonGhost,
  buttonPrimary,
  colors,
  glassCard,
  pageShell,
  pageSubtitle,
  sectionKicker,
  sectionTitle,
  surfaceCard,
  surfaceCardStrong,
} from '@/lib/design-system'
import { buildProductAccessState, type ProductAccessState } from '@/lib/access-model'
import { getPlanDestinationHref, getPlanSignupHref, getPlanUnlockHref } from '@/lib/plan-intent'
import { getPricingPlan, type PricingPlanId } from '@/lib/pricing-plans'
import {
  getMembershipTier,
  TIER_HOMEPAGE_STORY,
  type MembershipTierId,
} from '@/lib/product-story'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type TierTheme = {
  shellBorder: string
  shellShadow: string
  shellBackground: string
  chapterGlow: string
  contentBackground: string
  previewBackground: string
  previewDivider: string
  tierBadge: CSSProperties
  priceColor: string
  numberColor: string
  accentLabel: string
  accentBorder: string
  accentBackground: string
  accentText: string
  primaryButton: CSSProperties
}

type TierSectionConfig = {
  planId: PricingPlanId
  stage: string
  label: string
  headline: string
  copy: string
  bullets: string[]
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  snapshot: ReactNode
  featured?: boolean
  featuredNote?: string
}

type HeroSearchFilter = 'players' | 'teams' | 'leagues' | 'flight' | 'area'

const heroSearchFilters: Array<{
  value: HeroSearchFilter
  label: string
  hint: string
  placeholder: string
  links: Array<{ href: string; label: string }>
}> = [
  {
    value: 'players',
    label: 'Player name',
    hint: 'Results focus on player profiles, ratings, and Player prep.',
    placeholder: 'Search a player name...',
    links: [
      { href: '/explore/players', label: 'Find a player' },
      { href: '/explore/rankings', label: 'Rankings' },
      { href: '/mylab', label: 'Open My Lab' },
    ],
  },
  {
    value: 'teams',
    label: 'Team',
    hint: 'Results focus on team pages, league context, and captain workflows.',
    placeholder: 'Search a team name...',
    links: [
      { href: '/explore/teams', label: 'Teams' },
      { href: '/captain', label: 'Team' },
      { href: '/captain/availability', label: 'Who can play' },
    ],
  },
  {
    value: 'leagues',
    label: 'Leagues',
    hint: 'Results focus on USTA and TIQ league containers.',
    placeholder: 'Search a league name...',
    links: [
      { href: '/explore/leagues', label: 'Leagues' },
      { href: '/compete/leagues', label: 'League directory' },
      { href: '/pricing', label: 'League Office' },
    ],
  },
  {
    value: 'flight',
    label: 'Flight',
    hint: 'Results focus on rating and flight filters across league views.',
    placeholder: 'Search 3.5, 4.0, etc...',
    links: [
      { href: '/explore/leagues?scope=flight', label: 'Flights' },
      { href: '/explore/rankings', label: 'Rankings' },
      { href: '/explore/teams', label: 'Teams' },
    ],
  },
  {
    value: 'area',
    label: 'Area',
    hint: 'Results focus on districts, sections, and local league context.',
    placeholder: 'Search city, district, or section...',
    links: [
      { href: '/explore/leagues?scope=area', label: 'Areas' },
      { href: '/explore/teams', label: 'Teams nearby' },
      { href: '/explore/players', label: 'Players nearby' },
    ],
  },
]

const coreConversionTierIds: PricingPlanId[] = ['free', 'player_plus', 'coach', 'captain', 'league']
const commandModes: Array<{
  planId: PricingPlanId
  lane: string
  action: string
  label: string
  href: string
  cta: string
  icon: TiqFeatureIconName
  proof: string[]
}> = [
  {
    planId: 'free',
    lane: 'Find',
    action: 'Search the tennis map',
    label: 'Players, teams, leagues, rankings',
    href: '/explore',
    cta: 'Start searching',
    icon: 'opponentScouting',
    proof: ['Player profiles', 'Team pages', 'Rankings'],
  },
  {
    planId: 'player_plus',
    lane: 'You',
    action: 'Open your lab',
    label: 'My Lab, data, matchups, messages',
    href: '/pricing#player_plus',
    cta: 'Unlock Player',
    icon: 'myLab',
    proof: ['Linked player', 'Next matchup', 'Goal notes'],
  },
  {
    planId: 'coach',
    lane: 'Coach',
    action: 'Develop players',
    label: 'Lessons, assignments, Tactical Studio',
    href: '/pricing#coach',
    cta: 'Unlock Coach',
    icon: 'scenarioBuilder',
    proof: ['Students', 'Drill boards', 'Check-ins'],
  },
  {
    planId: 'captain',
    lane: 'Team',
    action: 'Build the week',
    label: 'Availability, lineup, message status',
    href: '/pricing#captain',
    cta: 'Unlock Captain',
    icon: 'lineupBuilder',
    proof: ['8 / 10 available', 'Lineup ready', 'Message queued'],
  },
  {
    planId: 'league',
    lane: 'League',
    action: 'Run the season',
    label: 'Entries, schedule, standings, results',
    href: '/pricing#league',
    cta: 'Open Leagues',
    icon: 'teamRankings',
    proof: ['Approvals', 'Schedule', 'Standings'],
  },
  {
    planId: 'full_court',
    lane: 'Full-Court',
    action: 'Run every tennis job',
    label: 'Coach, Captain, League, and unlimited tournaments',
    href: '/pricing#full_court',
    cta: 'Unlock Full-Court',
    icon: 'teamRankings',
    proof: ['Coach', 'Captain', 'League'],
  },
]
type CommandTask = {
  title: string
  detail: string
  metric: string
  href: string
  requiredPlan: PricingPlanId
  tint: 'green' | 'blue' | 'amber' | 'teal'
  graphic: 'court' | 'lineup' | 'calendar' | 'clipboard'
  icon: TiqFeatureIconName
}

const commandTaskSets: Record<PricingPlanId, CommandTask[]> = {
  free: [
    {
      title: 'Find a player',
      detail: 'Public profiles, rating shape, and team context.',
      metric: 'Free',
      href: '/explore/players',
      requiredPlan: 'free',
      tint: 'green',
      graphic: 'court',
      icon: 'playerRatings',
    },
    {
      title: 'Browse teams',
      detail: 'Rosters, sections, records, and nearby competition.',
      metric: 'Free',
      href: '/explore/teams',
      requiredPlan: 'free',
      tint: 'blue',
      graphic: 'lineup',
      icon: 'lineupBuilder',
    },
    {
      title: 'Check standings',
      detail: 'League tables and flight context without a login.',
      metric: 'Free',
      href: '/explore/leagues',
      requiredPlan: 'free',
      tint: 'amber',
      graphic: 'calendar',
      icon: 'schedule',
    },
    {
      title: 'Check rankings',
      detail: 'Scan the field before opening a player or flight.',
      metric: 'Free',
      href: '/explore/rankings',
      requiredPlan: 'free',
      tint: 'teal',
      graphic: 'clipboard',
      icon: 'reports',
    },
  ],
  player_plus: [
    {
      title: 'Prep matchup',
      detail: 'Compare strengths, rating movement, and doubles fit.',
      metric: 'Player',
      href: '/matchup',
      requiredPlan: 'player_plus',
      tint: 'green',
      graphic: 'court',
      icon: 'matchupAnalysis',
    },
    {
      title: 'Open My Lab',
      detail: 'Track notes, goals, messages, and next opponents.',
      metric: 'Player',
      href: '/mylab',
      requiredPlan: 'player_plus',
      tint: 'blue',
      graphic: 'lineup',
      icon: 'myLab',
    },
    {
      title: 'Plan next match',
      detail: 'Turn schedule context into simple prep.',
      metric: 'Player',
      href: '/compete/schedule',
      requiredPlan: 'player_plus',
      tint: 'amber',
      graphic: 'calendar',
      icon: 'schedule',
    },
    {
      title: 'Save insight',
      detail: 'Keep the important findings tied to your player.',
      metric: 'Player',
      href: '/mylab',
      requiredPlan: 'player_plus',
      tint: 'teal',
      graphic: 'clipboard',
      icon: 'reports',
    },
  ],
  coach: [
    {
      title: 'Map a drill',
      detail: 'Use TIQ Tactical Studio to build the court picture before practice.',
      metric: 'Coach',
      href: '/tactics',
      requiredPlan: 'coach',
      tint: 'green',
      graphic: 'court',
      icon: 'scenarioBuilder',
    },
    {
      title: 'Plan lesson',
      detail: 'Turn a player focus into blocks, cues, and homework.',
      metric: 'Coach',
      href: '/player-development/coach-planner',
      requiredPlan: 'coach',
      tint: 'blue',
      graphic: 'clipboard',
      icon: 'schedule',
    },
    {
      title: 'Assign work',
      detail: 'Connect the next drill to a player development path.',
      metric: 'Coach',
      href: '/player-development',
      requiredPlan: 'coach',
      tint: 'amber',
      graphic: 'lineup',
      icon: 'reports',
    },
    {
      title: 'Message player',
      detail: 'Keep coach-player follow-up tied to the tennis work.',
      metric: 'Coach',
      href: '/messages',
      requiredPlan: 'coach',
      tint: 'teal',
      graphic: 'calendar',
      icon: 'messagingCenter',
    },
  ],
  captain: [
    {
      title: 'Who can play',
      detail: 'Turn roster replies into a clean weekly player pool.',
      metric: 'Captain',
      href: '/captain/availability',
      requiredPlan: 'captain',
      tint: 'amber',
      graphic: 'calendar',
      icon: 'reliabilityIndex',
    },
    {
      title: 'Plan practice',
      detail: 'Schedule practice, invite the roster, and collect RSVPs.',
      metric: 'Captain',
      href: '/captain/practice',
      requiredPlan: 'captain',
      tint: 'green',
      graphic: 'calendar',
      icon: 'schedule',
    },
    {
      title: 'Build lineup',
      detail: 'Availability, pairings, and court-by-court confidence.',
      metric: 'Captain',
      href: '/captain/lineup-builder',
      requiredPlan: 'captain',
      tint: 'blue',
      graphic: 'lineup',
      icon: 'lineupBuilder',
    },
    {
      title: 'Send plan',
      detail: 'Message the team from the same workspace.',
      metric: 'Captain',
      href: '/captain/messaging',
      requiredPlan: 'captain',
      tint: 'teal',
      graphic: 'clipboard',
      icon: 'messagingCenter',
    },
  ],
  league: [
    {
      title: 'Shared calendar',
      detail: 'Publish, propose, confirm, and track match dates.',
      metric: 'League',
      href: '/compete/schedule',
      requiredPlan: 'league',
      tint: 'amber',
      graphic: 'calendar',
      icon: 'schedule',
    },
    {
      title: 'Build tournament',
      detail: 'Create a draw, seed entrants, and preview the path.',
      metric: 'Full-Court',
      href: '/league-coordinator/tournaments',
      requiredPlan: 'full_court',
      tint: 'blue',
      graphic: 'lineup',
      icon: 'teamRankings',
    },
    {
      title: 'Team book',
      detail: 'Enter team results and keep standings moving.',
      metric: 'League',
      href: '/league-coordinator/results',
      requiredPlan: 'league',
      tint: 'teal',
      graphic: 'clipboard',
      icon: 'reports',
    },
    {
      title: 'Player book',
      detail: 'Run individual leagues with clear records.',
      metric: 'League',
      href: '/league-coordinator/individual-results',
      requiredPlan: 'league',
      tint: 'green',
      graphic: 'court',
      icon: 'playerRatings',
    },
  ],
  full_court: [
    {
      title: 'Build tournament',
      detail: 'Create a draw, seed entrants, and preview the path.',
      metric: 'Full-Court',
      href: '/league-coordinator/tournaments',
      requiredPlan: 'full_court',
      tint: 'teal',
      graphic: 'calendar',
      icon: 'teamRankings',
    },
    {
      title: 'Open Team Hub',
      detail: 'Use Captain Tools alongside League Office operations.',
      metric: 'Full-Court',
      href: '/captain',
      requiredPlan: 'captain',
      tint: 'amber',
      graphic: 'lineup',
      icon: 'lineupBuilder',
    },
    {
      title: 'Track results',
      detail: 'Keep standings, scorecards, and rankings moving.',
      metric: 'Full-Court',
      href: '/league-coordinator/results',
      requiredPlan: 'league',
      tint: 'green',
      graphic: 'clipboard',
      icon: 'reports',
    },
    {
      title: 'Open player book',
      detail: 'See player context across the full operation.',
      metric: 'Full-Court',
      href: '/league-coordinator/individual-results',
      requiredPlan: 'league',
      tint: 'blue',
      graphic: 'court',
      icon: 'playerRatings',
    },
  ],
}

const commandModeDetails: Record<
  PricingPlanId,
  {
    headline: string
    subhead: string
    searchPlaceholder: string
    queue: string[]
    unlockLine: string
  }
> = {
  free: {
    headline: 'More Tennis. Less Chaos.',
    subhead: 'Start with the tennis map, then unlock the workspace that saves your week.',
    searchPlaceholder: 'Search players, teams, leagues, ratings...',
    queue: ['Find a player', 'Browse teams', 'Check standings', 'Check rankings'],
    unlockLine: 'Free stays useful. Unlock My Lab, Team Hub, or League Office when the job becomes personal, team-based, or league-wide.',
  },
  player_plus: {
    headline: 'Turn public data into your personal lab.',
    subhead: 'Player adds My Lab, data refreshes, matchup prep, and messages around your next match.',
    searchPlaceholder: 'Search an opponent, partner, or player...',
    queue: ['Open My Lab', 'Fix tennis info', 'Prep matchup', 'Review messages'],
    unlockLine: 'Player unlocks My Lab, data refreshes, matchup prep, and messages.',
  },
  coach: {
    headline: 'Develop players with a clearer plan.',
    subhead: 'Coach turns lessons, tactical boards, assignments, scheduling, and student tracking into one workspace.',
    searchPlaceholder: 'Search player, drill, lesson, or assignment...',
    queue: ['Map a drill', 'Plan lesson', 'Assign work', 'Message player'],
    unlockLine: 'Coach unlocks lessons, student tracking, assignments, tactical boards, and coach-player communication.',
  },
  captain: {
    headline: 'Make the weekly team decision simpler.',
    subhead: 'Captain turns availability, practice, lineup building, and team messages into one practical match-week desk.',
    searchPlaceholder: 'Search player, opponent team, or lineup...',
    queue: ['Who can play', 'Plan practice', 'Build lineup', 'Send plan'],
    unlockLine: 'Captain includes Player features plus availability, practice scheduling, lineup, and team message workflows.',
  },
  league: {
    headline: 'Run the season with structure.',
    subhead: 'League keeps seasons visible, organized, and easier to explain from calendar through results.',
    searchPlaceholder: 'Search league, flight, team, or result...',
    queue: ['Shared calendar', 'Build tournament', 'Team book', 'Player book'],
    unlockLine: 'League unlocks shared calendar, league spaces, team books, and player books.',
  },
  full_court: {
    headline: 'Run the full court from one workspace.',
    subhead: 'Full-Court combines My Lab, Coach Hub, Team Hub, League Office, and unlimited Tournament Desk operations.',
    searchPlaceholder: 'Search player, team, league, or tournament...',
    queue: ['Build tournament', 'Open Team Hub', 'Track results', 'Open player book'],
    unlockLine: 'Full-Court unlocks My Lab, Coach Hub, Team Hub, League Office, and unlimited Tournament Desk.',
  },
}
const commandCenterSurfaceBackground =
  'var(--portal-surface-bg)'
const commandActiveCardBackground = 'var(--portal-active-card-bg)'

const homeCommandTaskCardStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  gap: 8,
  minHeight: 80,
  padding: '10px 8px',
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(255,255,255,0.055)',
  color: 'var(--foreground)',
  minWidth: 0,
  textAlign: 'center',
}

const homeCommandTaskIconShellStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 38,
  height: 38,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.045)',
}

const homeCommandTaskBodyStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minWidth: 0,
  maxWidth: '100%',
}

const homeCommandTaskTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12.5,
  lineHeight: 1.15,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const homeCommandTaskLockStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  flex: '0 0 auto',
  color: 'var(--shell-copy-muted)',
}

function getHomeCommandActiveTaskStyle(accent: string): CSSProperties {
  return {
    border: `1px solid ${accent}`,
    background: commandActiveCardBackground,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px color-mix(in srgb, ${accent} 18%, transparent)`,
  }
}

// Kept temporarily as a fallback while the command-center homepage is reviewed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildTierSection(planId: MembershipTierId, snapshot: ReactNode, featured = false): TierSectionConfig {
  const tier = getMembershipTier(planId)
  const story = TIER_HOMEPAGE_STORY[planId]
  return {
    planId,
    label: tier.name,
    stage: story.stage,
    headline: story.headline,
    copy: story.copy,
    bullets: story.bullets,
    primaryCta: story.primaryCta,
    secondaryCta: story.secondaryCta,
    snapshot,
    featured,
    featuredNote: story.featuredNote,
  }
}

function getPlanIcon(planId: PricingPlanId): TiqFeatureIconName {
  if (planId === 'player_plus') return 'myLab'
  if (planId === 'coach') return 'scenarioBuilder'
  if (planId === 'captain') return 'captainDashboard'
  if (planId === 'league') return 'teamRankings'
  if (planId === 'full_court') return 'teamRankings'
  return 'playerRatings'
}

function canUseTier(access: ProductAccessState, planId: PricingPlanId) {
  if (planId === 'free') return true
  if (planId === 'player_plus') return access.canUseAdvancedPlayerInsights
  if (planId === 'coach') return access.canUseCoachWorkflow
  if (planId === 'captain') return access.canUseCaptainWorkflow
  if (planId === 'league') return access.canUseLeagueTools
  if (planId === 'full_court') return access.currentPlanId === 'full_court'
  return false
}

function getTierOpenLabel(planId: PricingPlanId) {
  if (planId === 'player_plus') return 'Open My Lab'
  if (planId === 'coach') return 'Open Coach Hub'
  if (planId === 'captain') return 'Open Team Hub'
  if (planId === 'league') return 'Open League Office'
  if (planId === 'full_court') return 'Open Full-Court'
  return 'Explore Free'
}

function getTierAccessPresentation(planId: PricingPlanId, access: ProductAccessState, authenticated: boolean, accessPending = false) {
  if (authenticated && accessPending) {
    return {
      active: true,
      statusLabel: 'Checking',
      priceLabel: 'Checking',
      primaryCta: {
        label: getTierOpenLabel(planId),
        href: getPlanDestinationHref(planId),
      },
    }
  }

  const active = canUseTier(access, planId)
  const destinationHref = getPlanDestinationHref(planId)
  const story = TIER_HOMEPAGE_STORY[planId]

  if (active) {
    return {
      active,
      statusLabel: planId === 'free' ? 'Open' : 'Active',
      priceLabel: planId === 'free' ? getPricingPlan(planId).priceLabel : 'Active',
      primaryCta: {
        label: getTierOpenLabel(planId),
        href: destinationHref,
      },
    }
  }

  return {
    active,
    statusLabel: 'Locked',
    priceLabel: getPricingPlan(planId).priceLabel,
    primaryCta: {
      label: story.primaryCta.label,
      href: authenticated ? getPlanUnlockHref(planId, destinationHref) : getPlanSignupHref(planId, destinationHref),
    },
  }
}

// Kept temporarily as a fallback while the shared PortalToolBar becomes the single command-center source.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CommandCenterHome({
  access,
  authenticated,
  firstName,
  profileLinked,
  profileResolved,
  accessPending,
}: {
  access: ProductAccessState
  authenticated: boolean
  firstName: string
  profileLinked: boolean
  profileResolved: boolean
  accessPending: boolean
}) {
  const router = useRouter()
  const { isMobile, isSmallMobile } = useViewportBreakpoints()
  const [query, setQuery] = useState('')
  const [activeLane, setActiveLane] = useState<PricingPlanId>(() =>
    authenticated ? getPreferredPortalLane(access) : 'free',
  )
  const selectedDetails = commandModeDetails[activeLane]
  const selectedTasks = commandTaskSets[activeLane]
  const activeAccent = getModeAccent(activeLane)
  const needsProfileLink = authenticated && profileResolved && !profileLinked
  const heroHeadline = authenticated
    ? firstName
      ? `Hi ${firstName}, welcome back!`
      : needsProfileLink
        ? 'Welcome back. Set your profile.'
        : 'Welcome back.'
    : selectedDetails.headline
  const heroSubhead = needsProfileLink
    ? 'TenAceIQ knows your account is signed in, but it does not know which player record should power your workspace yet.'
    : authenticated
      ? 'What do we want to work on today?'
    : selectedDetails.subhead

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const scope = activeLane === 'league' ? 'leagues' : activeLane === 'captain' ? 'teams' : 'players'
    const params = new URLSearchParams({ scope })
    if (query.trim()) params.set('q', query.trim())
    router.push(`/explore/search?${params.toString()}`)
  }

  return (
    <section
      aria-label="TenAceIQ platform hub"
      style={{
        position: 'relative',
        display: 'grid',
        gap: isMobile ? 16 : 18,
        borderRadius: isSmallMobile ? 24 : 30,
        border: '1px solid rgba(116,190,255,0.15)',
        background: commandCenterSurfaceBackground,
        color: 'var(--foreground)',
        boxShadow: '0 28px 80px rgba(2, 10, 24, 0.32), inset 0 1px 0 rgba(255,255,255,0.06)',
        overflow: 'hidden',
        padding: isSmallMobile ? 16 : isMobile ? 18 : 26,
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        contain: 'layout paint',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: isMobile ? 16 : 22,
          alignItems: 'start',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'grid', gap: isMobile ? 16 : 18, minWidth: 0 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, auto)',
              gap: 14,
              alignItems: 'center',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
              <h1
                style={{
                  margin: 0,
                  maxWidth: 760,
                  color: 'var(--foreground-strong)',
                  fontSize: 'clamp(1.75rem, 3.5vw, 3.05rem)',
                  lineHeight: 0.98,
                  letterSpacing: 0,
                  fontWeight: 950,
                  overflowWrap: 'anywhere',
                }}
              >
                {heroHeadline}
              </h1>
              <p
                style={{
                  margin: 0,
                  maxWidth: 700,
                  color: 'var(--shell-copy-muted)',
                  fontSize: isMobile ? 13 : 14,
                  lineHeight: 1.5,
                }}
              >
                {heroSubhead}
              </p>
              {needsProfileLink ? (
                <Link href="/profile" style={profileLinkNoticeStyle}>
                  <span style={homeLockChipStyle}>
                    <NavLockIcon size={14} />
                  </span>
                  <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                    <strong style={profileLinkNoticeTitleStyle}>Profile needs one more step</strong>
                    <span style={profileLinkNoticeTextStyle}>Choose or create your player. Then My Lab, Matchup, Team, and League can start from you.</span>
                  </span>
                  <span style={profileLinkNoticeCtaStyle}>Set profile</span>
                </Link>
              ) : null}
            </div>
          </div>

          <nav
            aria-label="Choose a TenAceIQ workflow"
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(4, minmax(0, 1fr))',
              gap: 10,
              minWidth: 0,
              width: '100%',
              maxWidth: '100%',
            }}
          >
            {commandModes.map((mode) => {
              const active = activeLane === mode.planId
              const accent = getModeAccent(mode.planId)
              const accessState = getTierAccessPresentation(mode.planId, access, authenticated, accessPending)
              return (
                <button
                  key={mode.planId}
                  type="button"
                  onClick={() => setActiveLane(mode.planId)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '42px minmax(0, 1fr) minmax(0, auto)' : '42px minmax(0, 1fr)',
                    gap: 10,
                    alignItems: 'center',
                    minHeight: isMobile ? 70 : 84,
                    padding: 12,
                    borderRadius: 18,
                    border: active ? `1px solid ${accent}` : '1px solid rgba(116,190,255,0.14)',
                    background: active ? commandActiveCardBackground : 'rgba(255,255,255,0.045)',
                    boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(116,190,255,0.08)' : undefined,
                    color: 'var(--foreground-strong)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    minWidth: 0,
                  }}
                >
                  <TiqFeatureIcon name={mode.icon} size="sm" variant={active ? 'surface' : 'ghost'} />
                  <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
                      <strong style={{ fontSize: 15, lineHeight: 1.05 }}>{mode.lane}</strong>
                      {!accessState.active && !isMobile ? (
                        <span title={`${mode.lane} unlocks with ${getPricingPlan(mode.planId).name}`} style={homeLockChipStyle}>
                          <NavLockIcon size={13} />
                        </span>
                      ) : null}
                    </span>
                    <span style={{ color: 'var(--shell-copy-muted)', fontSize: 12, lineHeight: 1.3, overflowWrap: 'anywhere' }}>
                      {accessState.active ? mode.action : 'Preview unlock'}
                    </span>
                  </span>
                  {!accessState.active && isMobile ? (
                    <span title={`${mode.lane} unlocks with ${getPricingPlan(mode.planId).name}`} style={homeLockChipStyle}>
                      <NavLockIcon size={14} />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>

          <form
            onSubmit={handleSubmit}
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, auto)',
              gap: 12,
              minWidth: 0,
            }}
          >
            <label
              style={{
                display: 'grid',
                gridTemplateColumns: '22px minmax(0, 1fr)',
                gap: 10,
                alignItems: 'center',
                minHeight: 54,
                padding: '0 16px',
                borderRadius: 18,
                border: '1px solid rgba(116,190,255,0.18)',
                background: 'rgba(255,255,255,0.07)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <SearchIcon />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={selectedDetails.searchPlaceholder}
                aria-label="Search players, teams, or leagues"
                style={{
                  width: '100%',
                  minWidth: 0,
                  border: 0,
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--foreground-strong)',
                  fontSize: 15,
                  fontWeight: 700,
                }}
              />
            </label>
            <button type="submit" style={{ ...buttonGhost, minHeight: 54, cursor: 'pointer' }}>
              Search
            </button>
          </form>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(4, minmax(0, 1fr))',
              gap: 10,
              minWidth: 0,
              width: '100%',
              maxWidth: '100%',
            }}
          >
            {selectedTasks.map((task) => {
              const taskAccess = getTierAccessPresentation(task.requiredPlan, access, authenticated, accessPending)
              const href = taskAccess.active ? task.href : getPlanUnlockHref(task.requiredPlan, task.href)
              const active = false
              return (
                <Link
                  key={task.title}
                  href={href}
                  title={task.detail}
                  style={{
                    ...homeCommandTaskCardStyle,
                    ...(active ? getHomeCommandActiveTaskStyle(activeAccent) : null),
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ ...homeCommandTaskIconShellStyle, borderColor: active ? activeAccent : 'rgba(116,190,255,0.14)' }}>
                    <TiqFeatureIcon name={task.icon} size="sm" variant={active ? 'surface' : 'ghost'} />
                  </span>
                  <span style={homeCommandTaskBodyStyle}>
                    <strong style={homeCommandTaskTitleStyle}>{task.title}</strong>
                    {!taskAccess.active ? (
                      <span style={homeCommandTaskLockStyle} aria-label={`${task.title} locked`}>
                        <NavLockIcon size={12} />
                      </span>
                    ) : null}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>

      </div>
    </section>
  )
}

function getModeAccent(planId: PricingPlanId) {
  if (planId === 'free') return '#9be11d'
  if (planId === 'player_plus') return '#4aa3ff'
  if (planId === 'coach') return '#a6ff2e'
  if (planId === 'captain') return '#f3b51b'
  return '#19c8b6'
}

function getPreferredPortalLane(access: ProductAccessState): PricingPlanId {
  if (access.currentPlanId === 'full_court') return 'full_court'
  if (access.canUseCoachWorkflow) return 'coach'
  if (access.canUseCaptainWorkflow) return 'captain'
  if (access.canUseLeagueTools) return 'league'
  if (access.canUseAdvancedPlayerInsights) return 'player_plus'
  return 'free'
}

function getDashboardLane(planId: PricingPlanId) {
  if (planId === 'player_plus') {
    return {
      label: 'My Lab',
      title: 'Your game in one place.',
      show: 'My Lab, data refreshes, matchup prep, and messages that matter to you.',
      removes: 'Re-checking scattered profiles before every match.',
      next: 'Unlock Player when you want TenAceIQ to revolve around your game.',
    }
  }

  if (planId === 'coach') {
    return {
      label: 'Coach',
      title: 'Player development, connected.',
      show: 'Lesson planning, students, assignments, Tactical Studio, and coach-player follow-through.',
      removes: 'Losing the thread between lessons, notes, drills, and player check-ins.',
      next: 'Unlock Coach when development work needs a real home.',
    }
  }

  if (planId === 'captain') {
    return {
      label: 'Team',
      title: 'The team week, organized.',
      show: 'Availability, lineup building, scouting, messaging, and weekly team decisions.',
      removes: 'Group-text chaos and last-minute lineup guesswork.',
      next: 'Unlock Captain when making the lineup should feel calmer.',
    }
  }

  if (planId === 'league') {
    return {
      label: 'Leagues',
      title: 'The season, in motion.',
      show: 'Entries, schedules, results, standings, and league visibility in one operating lane.',
      removes: 'Spreadsheet cleanup, unclear schedules, and result chasing.',
      next: 'Unlock League when members need one clear season home.',
    }
  }

  if (planId === 'full_court') {
    return {
      label: 'Full-Court',
      title: 'The full tennis operation.',
      show: 'My Lab, Coach Hub, Team Hub, League Office, ladders, and unlimited Tournament Desk operations in one connected suite.',
      removes: 'Splitting team, league, and tournament work across separate systems.',
      next: 'Unlock Full-Court when one role no longer covers the tennis work.',
    }
  }

  return {
    label: 'Explore',
    title: 'The public tennis map.',
    show: 'Players, teams, leagues, rankings, and public context stay searchable for free.',
    removes: 'Hunting through scattered tennis pages just to get oriented.',
    next: 'Start free, then unlock the lane that saves you real time.',
  }
}

// Kept temporarily while the unified homepage command hero is validated.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyCommandCenterHome({ access, authenticated }: { access: ProductAccessState; authenticated: boolean }) {
  const router = useRouter()
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const [query, setQuery] = useState('')
  const [activeLane, setActiveLane] = useState<PricingPlanId>('free')
  const startHref = authenticated ? getPlanDestinationHref('free') : '/join'
  const selectedMode = commandModes.find((mode) => mode.planId === activeLane) ?? commandModes[0]
  const selectedDetails = commandModeDetails[activeLane]
  const selectedAccess = getTierAccessPresentation(activeLane, access, authenticated)
  const selectedTasks = commandTaskSets[activeLane]

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const scope = activeLane === 'league' ? 'leagues' : activeLane === 'captain' ? 'teams' : 'players'
    const params = new URLSearchParams({ scope })
    if (query.trim()) params.set('q', query.trim())
    router.push(`/explore/search?${params.toString()}`)
  }

  return (
    <section
      aria-label="TenAceIQ platform hub"
      style={{
        borderRadius: isSmallMobile ? 24 : 30,
        border: '1px solid rgba(17,32,56,0.08)',
        background: '#f8fbff',
        color: '#07142c',
        boxShadow: '0 28px 80px rgba(9, 22, 48, 0.16)',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(min(100%, 190px), 224px) minmax(0, 1fr)',
          minHeight: isTablet ? 0 : 720,
          minWidth: 0,
        }}
      >
        <aside
          style={{
            display: 'grid',
            gridTemplateRows: isTablet ? undefined : 'minmax(0, auto) minmax(0, 1fr) minmax(0, auto)',
            gap: isTablet ? 10 : 0,
            padding: isTablet ? 14 : 0,
            background: isTablet
              ? 'linear-gradient(135deg, #061632 0%, #09264f 100%)'
              : 'linear-gradient(180deg, #061632 0%, #062044 52%, #041329 100%)',
            color: '#ffffff',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: isTablet ? 0 : '28px 24px',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={commandLogoMarkStyle} />
              <span style={{ fontSize: 25, fontWeight: 950, letterSpacing: 0, minWidth: 0, overflowWrap: 'anywhere' }}>
                TenAce<span style={{ color: '#9be11d' }}>IQ</span>
              </span>
            </div>
            {isTablet ? (
              <Link href={startHref} style={commandRailMiniCtaStyle}>
                Start
              </Link>
            ) : null}
          </div>

          <nav
            aria-label="Role lanes"
            style={{
              display: 'grid',
              gridTemplateColumns: isTablet ? 'repeat(4, minmax(0, 1fr))' : 'minmax(0, 1fr)',
              gap: isTablet ? 8 : 0,
              minWidth: 0,
            }}
          >
            {commandModes.map((mode) => (
              <CommandRailButton
                key={mode.planId}
                mode={mode}
                active={activeLane === mode.planId}
                compact={isTablet}
                onSelect={() => setActiveLane(mode.planId)}
              />
            ))}
          </nav>

          {isTablet ? null : (
            <div style={{ display: 'grid', gap: 18, padding: '24px', borderTop: '1px solid rgba(255,255,255,0.10)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '38px minmax(0, 1fr) auto', gap: 10, alignItems: 'center' }}>
                <span style={clubCrestStyle}>NP</span>
                <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <strong style={{ fontSize: 13, overflowWrap: 'anywhere' }}>Northpoint Tennis Club</strong>
                  <em style={{ color: 'rgba(255,255,255,0.74)', fontSize: 12, fontStyle: 'normal' }}>USTA | 3.5 Combo</em>
                </span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }}>&gt;</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'rgba(255,255,255,0.86)' }}>
                <span style={railIconDotStyle}>!</span>
                <span style={railIconDotStyle}>S</span>
                <span style={railIconDotStyle}>O</span>
              </div>
            </div>
          )}
        </aside>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.25fr) minmax(min(100%, 320px), 0.78fr)',
            gap: isMobile ? 16 : 22,
            padding: isSmallMobile ? 16 : isMobile ? 18 : 28,
            minWidth: 0,
          }}
        >
          <main style={{ display: 'grid', gap: isMobile ? 16 : 20, alignContent: 'start', minWidth: 0 }}>
            <div style={{ display: 'grid', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 14,
                  alignItems: 'start',
                  flexWrap: 'wrap',
                }}
              >
                <h1
                  style={{
                    margin: 0,
                    color: '#07142c',
                    fontSize: 'clamp(2rem, 4vw, 3rem)',
                    lineHeight: 1,
                    letterSpacing: '-0.035em',
                    fontWeight: 950,
                    overflowWrap: 'anywhere',
                  }}
                >
                  What do you need to do today?
                </h1>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link href={selectedAccess.primaryCta.href} style={commandGhostButtonStyle}>
                    {selectedAccess.statusLabel}
                  </Link>
                  <Link href={startHref} style={commandPrimaryButtonStyle}>
                    Start Free
                  </Link>
                </div>
              </div>
              <ModeIntroCard
                mode={selectedMode}
                active={selectedAccess.active}
                headline={selectedDetails.headline}
                subhead={selectedDetails.subhead}
              />

              <form
                onSubmit={handleSubmit}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, auto)',
                  gap: 12,
                  minWidth: 0,
                }}
              >
                <label style={commandSearchShellStyle}>
                  <SearchIcon />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={selectedDetails.searchPlaceholder}
                    aria-label="Search players, teams, or leagues"
                    style={commandSearchInputStyle}
                  />
                </label>
                <button type="submit" style={commandFilterButtonStyle}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>=</span>
                  Search
                </button>
              </form>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isSmallMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                gap: 12,
                minWidth: 0,
              }}
            >
              {selectedTasks.map((task) => {
                const taskAccess = getTierAccessPresentation(task.requiredPlan, access, authenticated)
                const href = taskAccess.active ? task.href : getPlanUnlockHref(task.requiredPlan, task.href)
                return (
                  <CommandActionTile
                    key={task.title}
                    tint={task.tint}
                    title={task.title}
                    detail={task.detail}
                    metric={task.metric}
                    locked={!taskAccess.active}
                    href={href}
                  >
                    <CommandTaskGraphic graphic={task.graphic} />
                  </CommandActionTile>
                )
              })}
            </div>

            <ModePrimaryPreview mode={activeLane} />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
                gap: 16,
                minWidth: 0,
              }}
            >
              <TodayQueuePreview mode={activeLane} items={selectedDetails.queue} />
              <UnlockPathPreview mode={activeLane} active={selectedAccess.active} line={selectedDetails.unlockLine} href={selectedAccess.primaryCta.href} cta={selectedAccess.primaryCta.label} />
            </div>
          </main>

          <aside style={{ display: 'grid', gap: 16, alignContent: 'start', minWidth: 0 }}>
            <CommandRightRail mode={activeLane} />
          </aside>
        </div>
      </div>
    </section>
  )
}

function CommandRailButton({
  mode,
  active,
  compact,
  onSelect,
}: {
  mode: (typeof commandModes)[number]
  active: boolean
  compact: boolean
  onSelect: () => void
}) {
  const color =
    mode.planId === 'free'
      ? '#35b93d'
      : mode.planId === 'player_plus'
        ? '#1477f2'
        : mode.planId === 'captain'
          ? '#f3b51b'
          : '#0c9a91'

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'grid',
        gridTemplateColumns: compact ? 'minmax(0, 1fr)' : '54px minmax(0, 1fr)',
        gap: compact ? 7 : 12,
        alignItems: 'center',
        minHeight: compact ? 90 : 118,
        padding: compact ? 10 : '0 20px',
        border: 'none',
        borderLeft: active && !compact ? `5px solid ${color}` : '5px solid transparent',
        borderRadius: compact ? 18 : 0,
        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: '#ffffff',
        textAlign: compact ? 'center' : 'left',
        cursor: 'pointer',
        minWidth: 0,
      }}
      aria-pressed={active}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: compact ? 42 : 54,
          height: compact ? 42 : 54,
          margin: compact ? '0 auto' : 0,
          borderRadius: 999,
          background: color,
          boxShadow: `0 12px 30px color-mix(in srgb, ${color} 32%, transparent)`,
        }}
      >
        <TiqFeatureIcon name={mode.icon} size="sm" variant="ghost" />
      </span>
      <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        <strong style={{ fontSize: compact ? 13 : 20, lineHeight: 1.05, fontWeight: 950 }}>{mode.lane}</strong>
        <span style={{ color: 'rgba(255,255,255,0.76)', fontSize: compact ? 11 : 12, lineHeight: 1.35, fontWeight: 700 }}>
          {mode.label}
        </span>
      </span>
    </button>
  )
}

function ModeIntroCard({
  mode,
  active,
  headline,
  subhead,
}: {
  mode: (typeof commandModes)[number]
  active: boolean
  headline: string
  subhead: string
}) {
  const accent =
    mode.planId === 'free'
      ? '#35b93d'
      : mode.planId === 'player_plus'
        ? '#1477f2'
        : mode.planId === 'captain'
          ? '#f3b51b'
          : '#0c9a91'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto)', gap: 12, alignItems: 'center', minWidth: 0, padding: 12, borderRadius: 10, border: '1px solid #e2eaf4', background: '#ffffff' }}>
      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: accent, fontSize: 11, fontWeight: 950, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{mode.lane} mode</span>
          <span style={{ ...rangePillStyle, ...(active ? activeRangePillStyle : null) }}>{active ? 'Unlocked' : 'Preview'}</span>
        </div>
        <strong style={{ color: '#07142c', fontSize: 18, lineHeight: 1.12, fontWeight: 950, overflowWrap: 'anywhere' }}>{headline}</strong>
        <span style={{ color: '#526177', fontSize: 13, lineHeight: 1.5 }}>{subhead}</span>
      </div>
      <TiqFeatureIcon name={mode.icon} size="lg" variant="surface" />
    </div>
  )
}

function CommandActionTile({
  tint,
  title,
  detail,
  metric,
  locked,
  href,
  children,
}: {
  tint: 'green' | 'blue' | 'amber' | 'teal'
  title: string
  detail: string
  metric: string
  locked: boolean
  href: string
  children: ReactNode
}) {
  const { isSmallMobile } = useViewportBreakpoints()
  const color = tint === 'green' ? '#39b54a' : tint === 'blue' ? '#1778ef' : tint === 'amber' ? '#e7a214' : '#0f9b91'
  const bg = tint === 'green' ? '#f5fff6' : tint === 'blue' ? '#f4f9ff' : tint === 'amber' ? '#fffaf0' : '#f2fffd'
  return (
    <Link
      href={href}
      style={{
        display: 'grid',
        gap: isSmallMobile ? 8 : 12,
        minHeight: isSmallMobile ? 126 : 164,
        padding: isSmallMobile ? 12 : 16,
        borderRadius: 10,
        border: `1px solid color-mix(in srgb, ${color} 34%, #d8e0ec 66%)`,
        background: bg,
        color: '#07142c',
        boxShadow: '0 12px 26px rgba(12, 30, 65, 0.06)',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'grid', placeItems: 'center', minHeight: isSmallMobile ? 62 : 78 }}>{children}</div>
      <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
        <strong style={{ fontSize: 15, fontWeight: 950, lineHeight: 1.15, overflowWrap: 'normal' }}>{title}</strong>
        {isSmallMobile ? null : <span style={{ color: '#526177', fontSize: 12, lineHeight: 1.35 }}>{detail}</span>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
          <span style={{ ...rangePillStyle, width: 'fit-content', background: locked ? '#fff3d7' : '#eef8f0', color: locked ? '#a96b00' : '#0d8a2b' }}>
            {metric}
          </span>
          <span style={{ display: isSmallMobile || locked ? 'none' : 'inline-flex', color, fontSize: 12, lineHeight: 1, fontWeight: 950, letterSpacing: '0.08em' }}>GO</span>
        </div>
      </div>
    </Link>
  )
}

function CommandTaskGraphic({ graphic }: { graphic: CommandTask['graphic'] }) {
  if (graphic === 'lineup') return <LineupGraphic />
  if (graphic === 'calendar') return <CalendarGraphic />
  if (graphic === 'clipboard') return <ClipboardGraphic />
  return <CourtCompareGraphic />
}

function TodayQueuePreview({ mode, items }: { mode: PricingPlanId; items: string[] }) {
  const accent = mode === 'free' ? '#35b93d' : mode === 'player_plus' ? '#1477f2' : mode === 'captain' ? '#f3b51b' : '#0c9a91'
  return (
    <section style={commandPanelStyle}>
      <h2 style={commandPanelTitleStyle}>Today Queue</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((item, index) => (
          <div key={item} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) minmax(0, auto)', gap: 10, alignItems: 'center', paddingTop: index === 0 ? 0 : 9, borderTop: index === 0 ? 'none' : '1px solid #e7edf5' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 999, background: `${accent}18`, color: accent, fontSize: 12, fontWeight: 950 }}>{index + 1}</span>
            <strong style={{ color: '#07142c', fontSize: 13, overflowWrap: 'anywhere' }}>{item}</strong>
            <span style={{ color: '#65738a', fontSize: 12 }}>Ready</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function UnlockPathPreview({
  mode,
  active,
  line,
  href,
  cta,
}: {
  mode: PricingPlanId
  active: boolean
  line: string
  href: string
  cta: string
}) {
  const tier = getMembershipTier(mode)
  return (
    <section
      style={{
        display: 'grid',
        gap: 14,
        minWidth: 0,
        padding: 16,
        borderRadius: 18,
        border: active ? '1px solid rgba(155,225,29,0.24)' : '1px solid rgba(116,190,255,0.14)',
        background: active
          ? 'linear-gradient(180deg, rgba(155,225,29,0.10), rgba(255,255,255,0.045))'
          : 'rgba(255,255,255,0.045)',
        color: 'var(--foreground)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div style={commandPanelHeaderStyle}>
        <h2
          style={{
            margin: 0,
            color: 'var(--foreground-strong)',
            fontSize: 16,
            lineHeight: 1.15,
            fontWeight: 950,
            letterSpacing: 0,
          }}
        >
          {active ? `${tier.name} is active` : `Unlock ${tier.name}`}
        </h2>
        <span style={{ ...rangePillStyle, ...(active ? activeRangePillStyle : null) }}>{active ? 'Open' : 'Preview'}</span>
      </div>
      <p style={{ margin: 0, color: 'var(--shell-copy-muted)', fontSize: 13, lineHeight: 1.55 }}>{line}</p>
      <Link href={href} style={{ ...buttonGhost, width: 'fit-content', minHeight: 38 }}>
        {cta}
      </Link>
    </section>
  )
}

function ModePrimaryPreview({ mode }: { mode: PricingPlanId }) {
  if (mode === 'free') return <DiscoveryMapPreview />
  if (mode === 'captain') return <CaptainDecisionPreview />
  if (mode === 'league') return <LeagueOpsPreview />
  return <PlayerScorecardPreview />
}

function CommandRightRail({ mode }: { mode: PricingPlanId }) {
  if (mode === 'free') {
    return (
      <>
        <PublicSearchPreview />
        <TeamMessagesPreview />
        <LeagueOverviewPreview />
      </>
    )
  }

  if (mode === 'player_plus') {
    return (
      <>
        <PlayerNextMatchPreview />
        <TeamMessagesPreview />
        <LeagueOverviewPreview />
      </>
    )
  }

  if (mode === 'league') {
    return (
      <>
        <LeagueOverviewPreview />
        <ResultsReviewPreview />
        <PublicSearchPreview />
      </>
    )
  }

  return (
    <>
      <TeamLineupOverview />
      <TeamMessagesPreview />
      <LeagueOverviewPreview />
    </>
  )
}

function DiscoveryMapPreview() {
  const { isMobile } = useViewportBreakpoints()
  return (
    <section style={commandPanelStyle}>
      <div style={commandPanelHeaderStyle}>
        <h2 style={commandPanelTitleStyle}>Explore Snapshot</h2>
        <Link href="/explore" style={plainBlueLinkStyle}>Open Explore</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: 14, minWidth: 0 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <MiniSearchResult title="Alex Kim" meta="3.5 USTA | Northpoint | 12-6 this year" tone="blue" />
          <MiniSearchResult title="Northpoint 3.5 Men" meta="Section 7 | 3-1 | 9 pts" tone="green" />
          <MiniSearchResult title="Riverside Racquets" meta="Upcoming opponent | strong doubles depth" tone="amber" />
        </div>
        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 8, background: '#f7fbff', border: '1px solid #e2eaf4' }}>
          <strong style={{ color: '#07142c', fontSize: 14 }}>Free shows the tennis map.</strong>
          <span style={{ color: '#526177', fontSize: 13, lineHeight: 1.55 }}>Search first, then choose whether the next job is personal prep, team decisions, or league operations.</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <MiniCount value="18k" label="Players" />
            <MiniCount value="1.2k" label="Teams" />
            <MiniCount value="95" label="Leagues" />
          </div>
        </div>
      </div>
    </section>
  )
}

function CaptainDecisionPreview() {
  return (
    <section style={commandPanelStyle}>
      <div style={commandPanelHeaderStyle}>
        <h2 style={commandPanelTitleStyle}>Captain Decision Desk</h2>
        <Link href="/captain" style={plainBlueLinkStyle}>Open Team</Link>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <DecisionRow title="Lineup confidence" meta="3 courts favored, 1 court close" trailing="72%" tone="green" />
        <DecisionRow title="Availability" meta="8 confirmed, 2 need follow-up" trailing="2 open" tone="amber" />
        <DecisionRow title="Opponent note" meta="Riverside is strongest at 1 doubles" trailing="Scout" tone="blue" />
      </div>
    </section>
  )
}

function LeagueOpsPreview() {
  return (
    <section style={commandPanelStyle}>
      <div style={commandPanelHeaderStyle}>
        <h2 style={commandPanelTitleStyle}>League Operations</h2>
        <Link href="/compete" style={plainBlueLinkStyle}>Open Leagues</Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <StatBox value="24" label="Teams Active" tone="green" />
        <StatBox value="7" label="Results To Review" tone="amber" />
        <StatBox value="96%" label="Schedule Filled" tone="blue" />
        <StatBox value="3" label="Flights Updated" tone="teal" />
      </div>
    </section>
  )
}

function PublicSearchPreview() {
  return (
    <section style={commandPanelStyle}>
      <div style={commandPanelHeaderStyle}>
        <h2 style={commandPanelTitleStyle}>Public Tennis Map</h2>
        <Link href="/explore" style={plainBlueLinkStyle}>Explore</Link>
      </div>
      <MiniSearchResult title="Player profiles" meta="Ratings, teams, leagues, and match history." tone="blue" />
      <MiniSearchResult title="Team pages" meta="Rosters, standings, and league context." tone="green" />
      <MiniSearchResult title="Rankings" meta="Section, flight, and area views." tone="amber" />
    </section>
  )
}

function PlayerNextMatchPreview() {
  return (
    <section style={commandPanelStyle}>
      <div style={commandPanelHeaderStyle}>
        <h2 style={commandPanelTitleStyle}>Next Match Prep</h2>
        <Link href="/matchup" style={plainBlueLinkStyle}>Compare</Link>
      </div>
      <DecisionRow title="Opponent pattern" meta="Wins quick when first serve lands." trailing="Watch" tone="amber" />
      <DecisionRow title="Your edge" meta="Return depth and second-serve pressure." trailing="Use" tone="green" />
      <DecisionRow title="Partner fit" meta="Kim / Patel trends up over 6 months." trailing="3.6" tone="blue" />
    </section>
  )
}

function ResultsReviewPreview() {
  return (
    <section style={commandPanelStyle}>
      <div style={commandPanelHeaderStyle}>
        <h2 style={commandPanelTitleStyle}>Results Review</h2>
        <span style={{ ...rangePillStyle, background: '#fff3d7', color: '#a96b00' }}>7 open</span>
      </div>
      <DecisionRow title="Northpoint vs Riverside" meta="Scorecard image needs confirmation." trailing="Review" tone="amber" />
      <DecisionRow title="Midtown vs Lakeside" meta="All courts confirmed." trailing="Done" tone="green" />
      <DecisionRow title="Westview roster" meta="One player mapping is uncertain." trailing="Fix" tone="blue" />
    </section>
  )
}

function PlayerScorecardPreview() {
  const { isMobile, isSmallMobile } = useViewportBreakpoints()

  return (
    <section style={commandPanelStyle}>
      <div style={commandPanelHeaderStyle}>
        <h2 style={commandPanelTitleStyle}>Your Scorecard</h2>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {['3M', '6M', '1Y', 'All'].map((item) => (
            <span key={item} style={{ ...rangePillStyle, ...(item === '6M' ? activeRangePillStyle : null) }}>{item}</span>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(min(100%, 220px), 0.42fr) minmax(0, 0.58fr)',
          gap: 18,
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : '86px minmax(0, 1fr)', gap: 14, alignItems: 'center' }}>
          <PlayerAvatar name="Alex Kim" size={86} />
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 19, color: '#07142c' }}>Alex Kim</strong>
              <span style={blueRatingPillStyle}>3.5</span>
            </div>
            <div style={{ color: '#65738a', fontSize: 13 }}>USTA Rating</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: '#36455c', fontSize: 13 }}>
              <span>Singles <strong style={{ color: '#1469db' }}>3.4</strong></span>
              <span>Doubles <strong style={{ color: '#1469db' }}>3.6</strong></span>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <MiniStatValue value="12-6" label="W-L This Year" />
              <MiniStatValue value="68%" label="Win %" />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: '#07142c', fontSize: 13, fontWeight: 850 }}>
            <span>Rating Trend</span>
            <span style={{ color: '#1469db' }}>3.5</span>
          </div>
          <RatingTrendSvg />
        </div>
      </div>

      <div style={{ height: 1, background: '#e7edf5' }} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 0.68fr) minmax(0, 0.72fr) minmax(0, 0.42fr)',
          gap: 14,
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: 10, alignItems: 'center' }}>
          <span style={{ color: '#637089', fontSize: 22 }}>Cal</span>
          <span style={{ display: 'grid', gap: 2 }}>
            <strong style={{ color: '#07142c', fontSize: 14 }}>May 24</strong>
            <span style={{ color: '#65738a', fontSize: 13 }}>Sat 9:00 AM</span>
          </span>
        </div>
        <div style={{ display: 'grid', gap: 5 }}>
          <strong style={{ color: '#07142c', fontSize: 14 }}>Men&apos;s 3.5 Doubles</strong>
          <span style={{ color: '#65738a', fontSize: 13 }}>Section 7 League</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <DuoAvatar names={['A', 'P']} />
            <span style={{ color: '#07142c', fontWeight: 900 }}>vs</span>
            <DuoAvatar names={['J', 'R']} />
          </div>
        </div>
        <Link href="/matchup" style={outlineBlueButtonStyle}>
          View Details
        </Link>
      </div>
    </section>
  )
}

function TeamLineupOverview() {
  return (
    <section style={commandPanelStyle}>
      <div style={commandPanelHeaderStyle}>
        <div style={{ display: 'grid', gap: 5 }}>
          <h2 style={commandPanelTitleStyle}>Team Lineup Overview</h2>
          <strong style={{ color: '#07142c', fontSize: 15 }}>Northpoint 3.5 Men</strong>
          <span style={{ color: '#65738a', fontSize: 13 }}>Section 7 | 3-1</span>
        </div>
        <Link href="/captain" style={plainBlueLinkStyle}>View Team</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', border: '1px solid #e3eaf3', borderRadius: 10, overflow: 'hidden' }}>
        <LineupSlot label="1 Singles" name="M. Patel" rating="3.7" status="Confirmed" />
        <LineupSlot label="2 Singles" name="A. Kim" rating="3.5" status="Confirmed" />
        <LineupSlot label="3 Singles" name="D. Nguyen" rating="3.2" status="Pending" />
        <LineupSlot label="1 Doubles" name="Kim / Patel" rating="3.6" status="Confirmed" pair />
        <LineupSlot label="2 Doubles" name="Lee / Cole" rating="3.3" status="Pending" pair />
        <InviteSlot />
      </div>
    </section>
  )
}

function TeamMessagesPreview() {
  return (
    <Link href="/messages" style={{ ...commandPanelStyle, display: 'grid', gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr) minmax(0, auto)', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 999, background: '#f2f7ff', color: '#1469db', border: '1px solid #dbe7f8' }}>Msg</span>
      <strong style={{ color: '#07142c', fontSize: 15 }}>Team Messages</strong>
      <span style={{ color: '#1469db', fontSize: 14, fontWeight: 850 }}>2 unread &gt;</span>
    </Link>
  )
}

function LeagueOverviewPreview() {
  const teams = [
    ['1', 'Northpoint 3.5 Men', '3', '1', '.750', '9'],
    ['2', 'Riverside Racquets', '3', '1', '.750', '9'],
    ['3', 'Midtown Aces', '2', '2', '.500', '6'],
    ['4', 'Lakeside Tennis', '1', '3', '.250', '3'],
  ] as const

  return (
    <section style={commandPanelStyle}>
      <div style={commandPanelHeaderStyle}>
        <h2 style={commandPanelTitleStyle}>League Overview</h2>
        <Link href="/league-coordinator" style={plainBlueLinkStyle}>View Full League</Link>
      </div>
      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #e7edf5', color: '#526177', fontSize: 13 }}>
        <span style={{ color: '#178a2f', fontWeight: 900, paddingBottom: 9, borderBottom: '2px solid #35b93d' }}>Standings</span>
        <span>Schedule</span>
        <span>Results</span>
      </div>
      <div style={{ color: '#07142c', fontWeight: 900, fontSize: 14 }}>Section 7 - Men&apos;s 3.5</div>
      <div style={{ display: 'grid', gap: 2 }}>
        <div style={standingsGridStyle}>
          <span />
          <span>Team</span>
          <span>W</span>
          <span>L</span>
          <span>PCT</span>
          <span>Pts</span>
        </div>
        {teams.map((team, index) => (
          <div
            key={team[1]}
            style={{
              ...standingsGridStyle,
              background: index === 0 ? '#eef8f0' : 'transparent',
              color: index === 0 ? '#0d7b2a' : '#07142c',
              borderRadius: 6,
              fontWeight: index === 0 ? 900 : 650,
            }}
          >
            {team.map((cell) => <span key={cell}>{cell}</span>)}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 10, paddingTop: 4 }}>
        <strong style={{ color: '#07142c', fontSize: 14 }}>Next Round</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)', gap: 10, alignItems: 'center', color: '#07142c' }}>
          <span style={{ display: 'grid', gap: 2, color: '#65738a', fontSize: 12 }}>
            <strong style={{ color: '#07142c' }}>May 24</strong>
            Sat 9:00 AM
          </span>
          <strong>vs</strong>
          <span style={{ fontSize: 13, fontWeight: 850 }}>Riverside Racquets &gt;</span>
        </div>
      </div>
    </section>
  )
}

// Kept temporarily as a fallback while the mode-based homepage is reviewed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RecentActivityPreview() {
  return (
    <section style={commandPanelStyle}>
      <h2 style={commandPanelTitleStyle}>Recent Activity</h2>
      <ActivityRow icon="OK" tone="green" title="Match vs Midtown Aces" meta="Won 6-3, 6-4" date="May 17" />
      <ActivityRow icon="+1" tone="blue" title="Rating updated" meta="Singles +0.1" date="May 16" />
      <ActivityRow icon="Cal" tone="amber" title="Match scheduled" meta="vs Riverside Racquets" date="May 24" />
    </section>
  )
}

// Kept temporarily as a fallback while the mode-based homepage is reviewed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StatsSnapshotPreview() {
  return (
    <section style={commandPanelStyle}>
      <h2 style={commandPanelTitleStyle}>Stats Snapshot <span style={{ color: '#65738a', fontSize: 12, fontWeight: 650 }}>(This Year)</span></h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <StatBox value="12" label="Matches Played" tone="green" />
        <StatBox value="68%" label="Win Percentage" tone="blue" />
        <StatBox value="1.41" label="Sets Won/Set Lost" tone="amber" />
        <StatBox value="74%" label="First Serve %" tone="teal" />
      </div>
    </section>
  )
}

function LineupSlot({
  label,
  name,
  rating,
  status,
  pair = false,
}: {
  label: string
  name: string
  rating: string
  status: 'Confirmed' | 'Pending'
  pair?: boolean
}) {
  const confirmed = status === 'Confirmed'
  return (
    <div style={{ display: 'grid', gap: 7, justifyItems: 'center', minWidth: 0, padding: '12px 8px', borderRight: '1px solid #e3eaf3', borderBottom: '1px solid #e3eaf3' }}>
      <span style={{ color: '#26364f', fontSize: 12, fontWeight: 800 }}>{label}</span>
      {pair ? <DuoAvatar names={name.split(' / ').map((part) => part.charAt(0))} /> : <PlayerAvatar name={name} size={48} />}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%' }}>
        <strong style={{ color: '#07142c', fontSize: 12, overflowWrap: 'anywhere' }}>{name}</strong>
        <span style={blueRatingPillStyle}>{rating}</span>
      </span>
      <span style={{ color: confirmed ? '#0d8a2b' : '#d58a00', fontSize: 12, fontWeight: 850 }}>{status}</span>
    </div>
  )
}

function InviteSlot() {
  return (
    <Link href="/captain/lineup-builder" style={{ display: 'grid', gap: 7, placeItems: 'center', minWidth: 0, padding: '12px 8px', borderBottom: '1px solid #e3eaf3', textDecoration: 'none' }}>
      <span style={{ color: '#26364f', fontSize: 12, fontWeight: 800 }}>Alt.</span>
      <span style={{ display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 999, background: '#eef2f7', color: '#8a97aa', fontWeight: 950 }}>+</span>
      <strong style={{ color: '#1469db', fontSize: 12 }}>Invite</strong>
    </Link>
  )
}

function ActivityRow({
  icon,
  tone,
  title,
  meta,
  date,
}: {
  icon: string
  tone: 'green' | 'blue' | 'amber'
  title: string
  meta: string
  date: string
}) {
  const color = tone === 'green' ? '#22a447' : tone === 'blue' ? '#1769e8' : '#e59a19'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr) minmax(0, auto)', gap: 12, alignItems: 'center', minWidth: 0, paddingTop: 10, borderTop: '1px solid #e7edf5' }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 999, background: `${color}18`, color, border: `1px solid ${color}33`, fontSize: 11, fontWeight: 950 }}>{icon}</span>
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <strong style={{ color: '#07142c', fontSize: 13, overflowWrap: 'anywhere' }}>{title}</strong>
        <span style={{ color, fontSize: 12, fontWeight: 800 }}>{meta}</span>
      </span>
      <span style={{ color: '#65738a', fontSize: 12, minWidth: 0, overflowWrap: 'anywhere' }}>{date}</span>
    </div>
  )
}

function MiniSearchResult({ title, meta, tone }: { title: string; meta: string; tone: 'green' | 'blue' | 'amber' }) {
  const color = tone === 'green' ? '#22a447' : tone === 'blue' ? '#1769e8' : '#e59a19'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr)', gap: 10, alignItems: 'center', minWidth: 0, padding: 10, borderRadius: 8, border: '1px solid #e2eaf4', background: '#ffffff' }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 999, background: `${color}18`, color, fontSize: 12, fontWeight: 950 }}>{title.slice(0, 2).toUpperCase()}</span>
      <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
        <strong style={{ color: '#07142c', fontSize: 13, overflowWrap: 'anywhere' }}>{title}</strong>
        <span style={{ color: '#526177', fontSize: 12, lineHeight: 1.4 }}>{meta}</span>
      </span>
    </div>
  )
}

function MiniCount({ value, label }: { value: string; label: string }) {
  return (
    <span style={{ display: 'grid', gap: 2, minWidth: 0, padding: 9, borderRadius: 8, background: '#ffffff', border: '1px solid #e2eaf4' }}>
      <strong style={{ color: '#07142c', fontSize: 18, lineHeight: 1 }}>{value}</strong>
      <span style={{ color: '#65738a', fontSize: 11, fontWeight: 800 }}>{label}</span>
    </span>
  )
}

function DecisionRow({
  title,
  meta,
  trailing,
  tone,
}: {
  title: string
  meta: string
  trailing: string
  tone: 'green' | 'blue' | 'amber'
}) {
  const color = tone === 'green' ? '#22a447' : tone === 'blue' ? '#1769e8' : '#e59a19'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto)', gap: 10, alignItems: 'center', minWidth: 0, padding: 11, borderRadius: 8, border: '1px solid #e2eaf4', background: '#fbfdff' }}>
      <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
        <strong style={{ color: '#07142c', fontSize: 13, overflowWrap: 'anywhere' }}>{title}</strong>
        <span style={{ color: '#526177', fontSize: 12, lineHeight: 1.4 }}>{meta}</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 28, padding: '0 9px', borderRadius: 999, background: `${color}18`, color, fontSize: 12, fontWeight: 950 }}>{trailing}</span>
    </div>
  )
}

function StatBox({ value, label, tone }: { value: string; label: string; tone: 'green' | 'blue' | 'amber' | 'teal' }) {
  const color = tone === 'green' ? '#22a447' : tone === 'blue' ? '#1769e8' : tone === 'amber' ? '#e59a19' : '#0f9b91'
  return (
    <div style={{ display: 'grid', gap: 5, minHeight: 82, padding: 12, borderRadius: 8, border: '1px solid #e2eaf4', background: '#fbfdff' }}>
      <strong style={{ color: '#07142c', fontSize: 24, lineHeight: 1 }}>{value}</strong>
      <span style={{ color: '#526177', fontSize: 12, fontWeight: 750, minHeight: 30 }}>{label}</span>
      <svg viewBox="0 0 74 18" width="74" height="18" aria-hidden="true">
        <path d="M2 14 L14 9 L24 12 L35 4 L46 8 L58 3 L72 7" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function PlayerAvatar({ name, size }: { name: string; size: number }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      style={{
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: 999,
        background: 'linear-gradient(135deg, #d7ecff 0%, #fff6dc 100%)',
        border: '2px solid #ffffff',
        boxShadow: '0 10px 22px rgba(10, 28, 58, 0.12)',
        color: '#07142c',
        fontSize: Math.max(11, Math.floor(size * 0.28)),
        fontWeight: 950,
      }}
    >
      {initials}
    </span>
  )
}

function DuoAvatar({ names }: { names: string[] }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 54 }}>
      {names.slice(0, 2).map((name, index) => (
        <span key={`${name}-${index}`} style={{ marginLeft: index === 0 ? 0 : -12 }}>
          <PlayerAvatar name={name} size={34} />
        </span>
      ))}
    </span>
  )
}

function MiniStatValue({ value, label }: { value: string; label: string }) {
  return (
    <span style={{ display: 'grid', gap: 2 }}>
      <strong style={{ color: '#07142c', fontSize: 17 }}>{value}</strong>
      <span style={{ color: '#65738a', fontSize: 11 }}>{label}</span>
    </span>
  )
}

function RatingTrendSvg() {
  return (
    <svg viewBox="0 0 440 120" width="100%" height="120" role="img" aria-label="Rating trend rising from 2.8 to 3.5">
      {[24, 48, 72, 96].map((y) => (
        <line key={y} x1="24" x2="420" y1={y} y2={y} stroke="#e7edf5" strokeWidth="1" />
      ))}
      <polyline
        points="28,94 64,86 98,73 132,78 166,70 200,75 234,62 268,58 302,46 336,52 370,42 404,34 420,39"
        fill="none"
        stroke="#1769e8"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'].map((month, index) => (
        <text key={month} x={34 + index * 62} y="116" fill="#65738a" fontSize="12">
          {month}
        </text>
      ))}
    </svg>
  )
}

function CourtCompareGraphic() {
  return (
    <svg viewBox="0 0 120 78" width="118" height="78" aria-hidden="true">
      <rect x="8" y="12" width="72" height="48" rx="5" fill="#47be4d" opacity="0.95" />
      <path d="M14 18 H74 M14 54 H74 M44 12 V60 M14 36 H74" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
      <circle cx="78" cy="38" r="23" fill="none" stroke="#213c30" strokeWidth="5" />
      <path d="M94 54 L112 72" stroke="#213c30" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

function LineupGraphic() {
  return (
    <svg viewBox="0 0 120 78" width="118" height="78" aria-hidden="true">
      <path d="M12 64 L32 22 H88 L108 64 Z" fill="#73b5ff" opacity="0.85" stroke="#1778ef" strokeWidth="2" />
      <path d="M28 64 L42 22 M92 64 L78 22 M12 64 H108 M60 22 V64 M23 45 H97" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
      <circle cx="38" cy="15" r="9" fill="#1778ef" />
      <circle cx="82" cy="15" r="9" fill="#1778ef" />
      <path d="M25 34 H51 M69 34 H95" stroke="#1778ef" strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
}

function CalendarGraphic() {
  return (
    <svg viewBox="0 0 120 78" width="118" height="78" aria-hidden="true">
      <rect x="30" y="14" width="60" height="52" rx="6" fill="#f4b11f" />
      <rect x="30" y="24" width="60" height="12" fill="#fff5d8" opacity="0.7" />
      {[44, 60, 76].map((x) => [46, 58].map((y) => <rect key={`${x}-${y}`} x={x - 3} y={y - 3} width="6" height="6" rx="1" fill="#ffffff" opacity="0.9" />))}
      <path d="M45 10 V22 M75 10 V22" stroke="#d58a00" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

function ClipboardGraphic() {
  return (
    <svg viewBox="0 0 120 78" width="118" height="78" aria-hidden="true">
      <rect x="32" y="12" width="56" height="56" rx="7" fill="#e5fffb" stroke="#0f9b91" strokeWidth="4" />
      <rect x="48" y="6" width="24" height="14" rx="5" fill="#0f9b91" />
      {[30, 42, 54].map((y) => (
        <g key={y}>
          <path d={`M44 ${y} l4 4 7 -9`} stroke="#0f9b91" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="62" x2="76" y1={y + 2} y2={y + 2} stroke="#0f9b91" strokeWidth="3" strokeLinecap="round" />
        </g>
      ))}
      <circle cx="88" cy="58" r="16" fill="#9be11d" stroke="#ffffff" strokeWidth="3" />
    </svg>
  )
}

export default function PreviewHomepage() {
  return (
    <SiteShell active="">
      <PreviewHomepageContent />
    </SiteShell>
  )
}

function PreviewHomepageContent() {
  const { isMobile } = useViewportBreakpoints()
  const { role, entitlements, userId, authResolved } = useAuth()
  const authenticated = Boolean(userId) || role !== 'public'
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [resolvedRole, entitlements])

  return (
    <div
        style={{
          ...pageShell,
          display: 'grid',
          gap: isMobile ? 16 : 18,
          paddingTop: isMobile ? 10 : 14,
        }}
      >
        {!authenticated ? <TierChoiceGrid access={access} authenticated={authenticated} /> : null}
      </div>
  )
}

// Kept temporarily as a fallback while the command-center homepage is reviewed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HeroSearchPreview({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const { isMobile, isSmallMobile } = useViewportBreakpoints()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<HeroSearchFilter>('players')
  const selectedFilter = useMemo(
    () => heroSearchFilters.find((item) => item.value === filter) ?? heroSearchFilters[0],
    [filter],
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedQuery = query.trim()
    const params = new URLSearchParams()

    if (trimmedQuery) {
      params.set('q', trimmedQuery)
    }

    const pathname = '/explore/search'
    params.set('scope', filter)

    const nextHref = params.size > 0 ? `${pathname}?${params.toString()}` : pathname
    router.push(nextHref)
  }

  if (compact) {
    return (
      <form
        onSubmit={handleSubmit}
        style={{
          ...glassCard,
          display: 'grid',
          gridTemplateColumns: isMobile
            ? 'minmax(0, 1fr)'
            : 'minmax(0, auto) minmax(min(100%, 132px), 160px) minmax(0, 1fr) minmax(0, auto)',
          gap: 8,
          alignItems: 'center',
          padding: isSmallMobile ? 10 : 11,
          maxWidth: isMobile ? '100%' : 760,
          minWidth: 0,
          border: '1px solid var(--home-search-frame-border)',
          background: isMobile
            ? 'color-mix(in srgb, var(--home-search-frame-bg) 78%, transparent 22%)'
            : 'var(--home-search-frame-bg)',
          boxShadow: isMobile ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'var(--home-search-frame-shadow)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
          }}
        >
          <span style={{ ...badgeGreen, minHeight: 32, paddingInline: 12, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
            Free search
          </span>
          {isMobile ? (
            <span
              style={{
                color: 'color-mix(in srgb, var(--brand-green) 78%, var(--foreground-strong) 22%)',
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Free entry
            </span>
          ) : null}
        </div>

        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as HeroSearchFilter)}
          style={{
            minHeight: 44,
            padding: '0 32px 0 12px',
            border: '1px solid var(--home-input-border)',
            background: 'var(--home-input-bg)',
            color: 'var(--foreground-strong)',
            fontSize: 13,
            fontWeight: 800,
            outline: 'none',
            borderRadius: 14,
            boxShadow: 'var(--home-control-shadow)',
            colorScheme: 'dark',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            backgroundImage: 'linear-gradient(45deg, transparent 50%, rgba(255,255,255,0.88) 50%), linear-gradient(135deg, rgba(255,255,255,0.88) 50%, transparent 50%)',
            backgroundPosition: 'calc(100% - 18px) calc(50% - 2px), calc(100% - 12px) calc(50% - 2px)',
            backgroundSize: '6px 6px, 6px 6px',
            backgroundRepeat: 'no-repeat',
          }}
          aria-label="Search focus"
        >
          {heroSearchFilters.map((option) => (
            <option
              key={option.value}
              value={option.value}
              style={{
                backgroundColor: '#13233b',
                color: '#f5f8ff',
              }}
            >
              {option.label}
            </option>
          ))}
        </select>

        <div
          style={{
            minHeight: 44,
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            border: '1px solid var(--home-input-border)',
            background: 'var(--home-input-bg)',
            borderRadius: 14,
            boxShadow: 'var(--home-control-shadow)',
          }}
        >
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={selectedFilter.placeholder}
            aria-label={`Search ${selectedFilter.label.toLowerCase()}`}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--foreground-strong)',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            ...buttonPrimary,
            minHeight: 44,
            minWidth: isMobile ? '100%' : 118,
            width: isMobile ? '100%' : undefined,
            paddingInline: 16,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Search
        </button>
      </form>
    )
  }

  return (
    <div
        style={{
          ...glassCard,
          padding: isSmallMobile ? 12 : compact || isMobile ? 13 : 18,
          display: 'grid',
          gap: compact ? 9 : isMobile ? 10 : 12,
          maxWidth: isMobile ? '100%' : 760,
          border: '1px solid var(--home-search-frame-border)',
          background: isMobile
            ? 'color-mix(in srgb, var(--home-search-frame-bg) 78%, transparent 22%)'
            : 'var(--home-search-frame-bg)',
          boxShadow: isMobile ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'var(--home-search-frame-shadow)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
      <div style={{ display: 'grid', gap: compact ? 6 : 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ ...badgeGreen, width: 'fit-content' }}>Start with search</div>
          <div
            style={{
              color: 'color-mix(in srgb, var(--brand-green) 78%, var(--foreground-strong) 22%)',
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Free entry
          </div>
        </div>
        <div
          style={{
            color: colors.textStrong,
            fontSize: isSmallMobile ? 17 : compact || isMobile ? 18 : 24,
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.12,
          }}
        >
          {isMobile ? 'Search the tennis map first.' : 'Find what you need without digging through the product.'}
        </div>
        <div style={{ color: colors.mutedStrong, fontSize: 13, lineHeight: compact ? 1.45 : 1.65 }}>
          {isMobile
            ? 'Find a player, team, league, flight, or area, then choose the tier that helps next.'
            : compact
              ? 'Search a player, team, league, flight, or area before choosing a tier.'
              : 'Start with a targeted search by player, team, league, flight, or area, then unlock the workspace that solves the next problem in your week.'}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'grid',
          gridTemplateColumns:
            compact || isMobile
              ? 'minmax(0, 1fr)'
              : 'minmax(min(100%, 172px), 196px) minmax(0, 1fr) minmax(min(100%, 148px), 156px)',
          gap: compact || isMobile ? 8 : 10,
          alignItems: compact || isMobile ? 'stretch' : 'end',
          minWidth: 0,
        }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ color: 'var(--muted-strong)', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Search by
          </span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as HeroSearchFilter)}
            style={{
              minHeight: isSmallMobile ? 52 : compact ? 48 : 56,
              padding: '0 14px',
              border: '1px solid var(--home-input-border)',
              background: 'var(--home-input-bg)',
              color: 'var(--foreground-strong)',
              fontSize: 14,
              fontWeight: 700,
              outline: 'none',
              borderRadius: 16,
              boxShadow: 'var(--home-control-shadow)',
              colorScheme: 'dark',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              backgroundImage: 'linear-gradient(45deg, transparent 50%, rgba(255,255,255,0.88) 50%), linear-gradient(135deg, rgba(255,255,255,0.88) 50%, transparent 50%)',
              backgroundPosition: 'calc(100% - 20px) calc(50% - 2px), calc(100% - 14px) calc(50% - 2px)',
              backgroundSize: '6px 6px, 6px 6px',
              backgroundRepeat: 'no-repeat',
              paddingRight: 34,
            }}
            aria-label="Search focus"
          >
            {heroSearchFilters.map((option) => (
              <option
                key={option.value}
                value={option.value}
                style={{
                  backgroundColor: '#13233b',
                  color: '#f5f8ff',
                }}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div
          style={{
            minHeight: isMobile ? 50 : compact ? 48 : 56,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: '1px solid var(--home-input-border)',
            background: 'var(--home-input-bg)',
            borderRadius: 16,
            boxShadow: 'var(--home-control-shadow)',
          }}
        >
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={selectedFilter.placeholder}
            aria-label={`Search ${selectedFilter.label.toLowerCase()}`}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--foreground-strong)',
              fontSize: 15,
              outline: 'none',
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            ...buttonPrimary,
            minHeight: isMobile ? 50 : compact ? 48 : 56,
            minWidth: compact || isMobile ? '100%' : 148,
            width: compact || isMobile ? '100%' : undefined,
            paddingInline: compact || isMobile ? 20 : 22,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Search now
        </button>
      </form>

      {compact ? null : <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ color: colors.mutedStrong, fontSize: 12, lineHeight: 1.55 }}>
          {selectedFilter.hint}
        </div>
        {isMobile ? null : <div style={{ color: 'var(--brand-blue-2)', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Opens focused Explore results
        </div>}
      </div>}

      {compact || isMobile ? null : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {selectedFilter.links.map((item) => (
          <Link key={item.href} href={item.href} style={chipLinkStyle}>
            {item.label}
          </Link>
        ))}
      </div>}
    </div>
  )
}

// Kept temporarily as a fallback while the command-center homepage is reviewed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AppCommandDeck({ access, authenticated }: { access: ProductAccessState; authenticated: boolean }) {
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const [selectedPlanId, setSelectedPlanId] = useState<PricingPlanId>('captain')
  const selectedMode = commandModes.find((mode) => mode.planId === selectedPlanId) ?? commandModes[2]
  const selectedTier = getMembershipTier(selectedMode.planId)
  const accessPresentation = getTierAccessPresentation(selectedMode.planId, access, authenticated)

  return (
    <section
      aria-label="TenAceIQ app preview"
      style={{
        ...surfaceCardStrong,
        display: 'grid',
        gap: isMobile ? 14 : 16,
        padding: isSmallMobile ? 15 : isMobile ? 18 : 22,
        border: '1px solid color-mix(in srgb, var(--brand-green) 22%, var(--shell-panel-border) 78%)',
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--shell-panel-bg) 86%, var(--brand-green) 14%) 0%, color-mix(in srgb, var(--shell-panel-bg) 92%, var(--brand-blue-2) 8%) 100%)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 0.9fr) minmax(min(100%, 520px), 1.1fr)',
          gap: isMobile ? 14 : 18,
          alignItems: 'stretch',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'grid', gap: 14, alignContent: 'start', minWidth: 0 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ ...sectionKicker, width: 'fit-content', marginBottom: 0 }}>App direction</div>
            <h2
              style={{
                margin: 0,
                color: 'var(--foreground-strong)',
                fontSize: 'clamp(2rem, 4vw, 3.7rem)',
                lineHeight: 0.96,
                fontWeight: 950,
                letterSpacing: '-0.05em',
                overflowWrap: 'anywhere',
              }}
            >
              What do you need to do today?
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
              gap: 9,
              minWidth: 0,
            }}
          >
            {commandModes.map((mode) => {
              const selected = mode.planId === selectedPlanId
              const theme = getTierTheme(mode.planId)
              return (
                <button
                  key={mode.planId}
                  type="button"
                  onClick={() => setSelectedPlanId(mode.planId)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 42px) minmax(0, 1fr)',
                    gap: 10,
                    alignItems: 'center',
                    minHeight: 82,
                    padding: 12,
                    borderRadius: 18,
                    border: selected ? `1px solid ${theme.priceColor}` : '1px solid var(--shell-panel-border)',
                    background: selected
                      ? `linear-gradient(135deg, color-mix(in srgb, var(--shell-chip-bg) 78%, ${theme.priceColor} 22%) 0%, var(--shell-chip-bg) 100%)`
                      : 'var(--shell-chip-bg)',
                    color: 'var(--foreground-strong)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: selected ? '0 18px 36px rgba(2,10,24,0.14)' : 'none',
                    minWidth: 0,
                  }}
                  aria-pressed={selected}
                >
                  <TiqFeatureIcon name={mode.icon} size="sm" variant={selected ? 'surface' : 'ghost'} />
                  <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                    <strong style={{ fontSize: 12, fontWeight: 950, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.priceColor }}>
                      {mode.lane}
                    </strong>
                    <span style={{ fontSize: 15, fontWeight: 950, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{mode.action}</span>
                    <span style={{ color: 'var(--shell-copy-muted)', fontSize: 12, lineHeight: 1.35, fontWeight: 750 }}>{mode.label}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
            <Link
              href={selectedMode.planId === 'free' ? selectedMode.href : accessPresentation.primaryCta.href}
              style={selectedMode.planId === 'captain' ? buttonPrimary : buttonGhost}
            >
              {selectedMode.planId === 'free' ? selectedMode.cta : accessPresentation.primaryCta.label}
            </Link>
            {selectedMode.planId === 'free' ? (
              <Link href="/pricing" style={buttonGhost}>
                See paid workspaces
              </Link>
            ) : (
              <Link href={selectedMode.href} style={buttonGhost}>
                {selectedMode.cta}
              </Link>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateRows: 'minmax(0, auto) minmax(0, 1fr)',
            gap: 12,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, auto)',
              gap: 10,
              alignItems: 'center',
              padding: 13,
              borderRadius: 20,
              border: '1px solid var(--shell-panel-border)',
              background: 'var(--shell-chip-bg)',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
              <div style={{ color: 'var(--brand-green)', fontSize: 11, fontWeight: 950, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                {selectedTier.name}
              </div>
              <div style={{ color: 'var(--foreground-strong)', fontSize: 22, fontWeight: 950, lineHeight: 1.05, letterSpacing: '-0.04em' }}>
                {selectedMode.action}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: isSmallMobile ? 'start' : 'end' }}>
              {selectedMode.proof.map((item) => (
                <span key={item} style={snapshotChipStyle}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          {selectedPlanId === 'free' ? (
            <FreeSnapshot />
          ) : selectedPlanId === 'player_plus' ? (
            <PlayerPlusSnapshot />
          ) : selectedPlanId === 'league' ? (
            <LeagueSnapshot />
          ) : (
            <CaptainSnapshot />
          )}
        </div>
      </div>
    </section>
  )
}

function TierChoiceGrid({ access, authenticated }: { access: ProductAccessState; authenticated: boolean }) {
  const { isMobile, isSmallMobile } = useViewportBreakpoints()

  return (
    <section
      style={{
        display: 'grid',
        gap: isMobile ? 12 : 13,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'end',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'grid', gap: 7, maxWidth: 760 }}>
          <div style={sectionKicker}>Start with your tennis job</div>
          <h2 style={{ ...sectionTitle, fontSize: 'clamp(1.85rem, 2.8vw, 2.65rem)', lineHeight: 1.02 }}>
            Explore, improve, compete, or manage with less chaos.
          </h2>
          <p style={{ ...pageSubtitle, marginTop: 0, fontSize: isMobile ? 14 : 15, lineHeight: 1.55 }}>
            Start with the tennis map. Unlock My Lab, Coach Hub, Team Hub, League Office, or Full-Court when that workspace saves your week.
          </p>
        </div>
        <Link href="/pricing" style={{ ...buttonGhost, minHeight: 40 }}>
          Full plan comparison
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(4, minmax(0, 1fr))',
          gap: 10,
          alignItems: 'stretch',
          minWidth: 0,
        }}
      >
        {coreConversionTierIds.map((planId) => {
          const story = TIER_HOMEPAGE_STORY[planId]
          const theme = getTierTheme(planId)
          const accessPresentation = getTierAccessPresentation(planId, access, authenticated)
          const dashboardLane = getDashboardLane(planId)
          const featured = planId === 'captain'

          return (
            <article
              key={planId}
              style={{
                position: 'relative',
                display: 'grid',
                gap: 10,
                alignContent: 'start',
                minHeight: isSmallMobile ? 0 : 248,
                padding: isSmallMobile ? 15 : 16,
                overflow: 'hidden',
                borderRadius: 18,
                border: featured ? '1px solid rgba(155,225,29,0.32)' : '1px solid rgba(116,190,255,0.12)',
                borderTop: `3px solid ${theme.priceColor}`,
                background: featured
                  ? 'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 88%, var(--brand-green) 12%) 0%, color-mix(in srgb, var(--surface) 94%, var(--brand-blue) 6%) 100%)'
                  : 'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 94%, var(--brand-blue-2) 6%) 0%, color-mix(in srgb, var(--surface) 96%, var(--foreground) 4%) 100%)',
                boxShadow: featured ? '0 22px 48px rgba(155,225,29,0.10)' : 'var(--shadow-soft)',
              }}
            >
              {featured ? (
                <div style={{ ...mostPopularBadgeStyle, width: 'fit-content' }}>Best team value</div>
              ) : null}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto)', justifyContent: 'space-between', gap: 10, alignItems: 'start', minWidth: 0 }}>
                <div style={{ display: 'grid', gap: 7, minWidth: 0 }}>
                  <span style={{ ...theme.tierBadge, width: 'fit-content' }}>{dashboardLane.label}</span>
                  <h3
                    style={{
                      margin: 0,
                      color: 'var(--foreground-strong)',
                      fontSize: 20,
                      lineHeight: 1.04,
                      letterSpacing: '-0.04em',
                      fontWeight: 900,
                    }}
                  >
                    {dashboardLane.title}
                  </h3>
                </div>
                <div style={{ ...compactPriceLabelStyle, color: theme.priceColor }}>
                  {accessPresentation.priceLabel}
                </div>
              </div>

              <p style={{ margin: 0, color: 'var(--muted-strong)', fontSize: 13, lineHeight: 1.48 }}>
                {dashboardLane.show}
              </p>

              <div
                style={{
                  display: 'grid',
                  gap: 6,
                  padding: 10,
                  borderRadius: 14,
                  border: '1px solid rgba(116,190,255,0.10)',
                  background: 'color-mix(in srgb, var(--surface-soft) 94%, var(--foreground) 6%)',
                }}
              >
                <div style={{ ...snapshotPanelLabelStyle, color: theme.priceColor }}>What it removes</div>
                <div style={{ color: 'var(--foreground-strong)', fontSize: 12, lineHeight: 1.4, fontWeight: 800 }}>
                  {dashboardLane.removes}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 4,
                  paddingLeft: 11,
                  borderLeft: `2px solid ${theme.priceColor}`,
                }}
              >
                <div style={{ ...snapshotPanelLabelStyle, color: theme.priceColor }}>Next action</div>
                <div style={{ color: 'var(--muted-strong)', fontSize: 12, lineHeight: 1.42, fontWeight: 700 }}>
                  {dashboardLane.next}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 6 }}>
                {story.bullets.slice(0, 2).map((bullet) => (
                  <div key={bullet} style={{ ...bulletRowStyle, fontSize: 12, lineHeight: 1.42 }}>
                    <span style={{ ...bulletDotStyle, marginTop: 6, background: theme.priceColor }} />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 'auto' }}>
                <Link href={accessPresentation.primaryCta.href} style={featured ? theme.primaryButton : getTierSecondaryButton(theme)}>
                  {accessPresentation.primaryCta.label}
                </Link>
                <span
                  title={accessPresentation.active ? accessPresentation.statusLabel : `${dashboardLane.label} unlock`}
                  aria-label={accessPresentation.active ? accessPresentation.statusLabel : `${dashboardLane.label} locked`}
                  style={accessPresentation.active ? activeTierBadgeStyle : homeLockChipStyle}
                >
                  {accessPresentation.active ? accessPresentation.statusLabel : <NavLockIcon size={13} />}
                </span>
              </div>
            </article>
          )
        })}
      </div>

      <FullCourtSuiteBanner access={access} authenticated={authenticated} />
    </section>
  )
}

function FullCourtSuiteBanner({ access, authenticated }: { access: ProductAccessState; authenticated: boolean }) {
  const { isMobile, isSmallMobile } = useViewportBreakpoints()
  const theme = getTierTheme('full_court')
  const accessPresentation = getTierAccessPresentation('full_court', access, authenticated)
  const suiteItems = [
    'Find',
    'Player',
    'Team',
    'League',
    'Unlimited tournaments',
    'Awards',
  ]

  return (
    <article
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, auto)',
        gap: isSmallMobile ? 13 : 18,
        alignItems: 'center',
        minWidth: 0,
        overflow: 'hidden',
        padding: isSmallMobile ? 16 : '18px 20px',
        borderRadius: 22,
        border: '1px solid rgba(155,225,29,0.42)',
        background:
          'linear-gradient(135deg, rgba(155,225,29,0.12) 0%, rgba(14,35,57,0.94) 40%, rgba(8,13,28,0.98) 100%)',
        boxShadow: '0 22px 58px rgba(2,8,23,0.34), 0 0 0 1px rgba(116,190,255,0.08) inset',
      }}
    >
      <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 10, alignContent: 'center', minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, alignItems: 'center' }}>
          <span style={fullCourtFeaturedBadgeStyle}>Championship suite</span>
          <span style={{ ...theme.tierBadge, width: 'fit-content' }}>Full-Court</span>
          <span style={{ ...compactPriceLabelStyle, color: theme.priceColor }}>{accessPresentation.priceLabel}</span>
        </div>
        <h3
          style={{
            margin: 0,
            color: 'var(--foreground-strong)',
            fontSize: 'clamp(1.65rem, 3vw, 2.45rem)',
            lineHeight: 1,
            letterSpacing: 0,
            fontWeight: 950,
            overflowWrap: 'anywhere',
          }}
        >
          Run the full tennis operation.
        </h3>
        <div style={fullCourtValueStripStyle}>
          {suiteItems.map((item) => (
            <span key={item} style={fullCourtValueChipStyle}>{item}</span>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'grid', gap: 8, justifyItems: isMobile ? 'start' : 'end', minWidth: 0 }}>
        <p style={{ margin: 0, color: 'var(--muted-strong)', fontSize: 13, lineHeight: 1.45, fontWeight: 800, maxWidth: 360, textAlign: isMobile ? 'left' : 'right' }}>
          Everything in the tiers above, plus unlimited tournament and league operations.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
          <Link href={accessPresentation.primaryCta.href} style={fullCourtPrimaryCtaStyle}>
            {accessPresentation.primaryCta.label}
          </Link>
          <Link href="/pricing#full_court" style={getTierSecondaryButton(theme)}>
            Compare suite
          </Link>
        </div>
      </div>
    </article>
  )
}

// Kept temporarily as a fallback while the command-center homepage is reviewed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RoleChooserPreview() {
  const { isMobile, isSmallMobile } = useViewportBreakpoints()
  const roleChoices: Array<{
    planId: PricingPlanId
    label: string
    title: string
    text: string
    href: string
    cta: string
  }> = [
    {
      planId: 'free',
      label: 'Explore tennis',
      title: 'Find the public tennis map',
      text: 'Players, teams, leagues, rankings, flights, and areas.',
      href: '/explore',
      cta: 'Explore',
    },
    {
      planId: 'player_plus',
      label: 'Improve my game',
      title: 'Make TenAceIQ personal',
      text: 'My Lab, data refreshes, matchup prep, and messages.',
      href: '/pricing#player_plus',
      cta: 'Player',
    },
    {
      planId: 'coach',
      label: 'Coach players',
      title: 'Develop players between lessons',
      text: 'Lesson plans, assignments, Tactical Studio, and check-ins.',
      href: '/pricing#coach',
      cta: 'Coach',
    },
    {
      planId: 'captain',
      label: 'Run my team',
      title: 'Make the weekly lineup call',
      text: 'Lineups, scouting, readiness, and team decisions.',
      href: '/pricing#captain',
      cta: 'Captain',
    },
    {
      planId: 'league',
      label: 'Manage a league',
      title: 'Operate the season',
      text: 'Structure, visibility, standings, schedules, and results.',
      href: '/pricing#league',
      cta: 'League',
    },
  ]

  return (
    <div
      style={{
        ...surfaceCardStrong,
        padding: isSmallMobile ? 16 : 20,
        display: 'grid',
        gap: isSmallMobile ? 12 : 14,
        minHeight: 100,
        position: 'relative',
        overflow: 'hidden',
        maxWidth: '100%',
        border: '1px solid var(--shell-panel-border)',
        background: 'var(--shell-panel-bg)',
        alignSelf: 'start',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-30px',
          width: isMobile ? 180 : 240,
          height: isMobile ? 180 : 240,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(155,225,29,0.18) 0%, rgba(74,163,255,0.08) 42%, transparent 72%)',
          filter: 'blur(6px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          display: 'grid',
          gap: 14,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: isMobile ? 'grid' : 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'start',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'grid', gap: 8, maxWidth: 440, minWidth: 0 }}>
            <div style={{ ...badgeGreen, width: 'fit-content', minHeight: 34 }}>Choose your path</div>
            <div
              style={{
                color: colors.textStrong,
                fontSize: isSmallMobile ? 25 : 28,
                fontWeight: 900,
                lineHeight: 1.02,
                letterSpacing: '-0.04em',
                overflowWrap: 'anywhere',
              }}
            >
              What are you here to do?
            </div>
            <div style={{ color: colors.mutedStrong, fontSize: 13, lineHeight: 1.55, maxWidth: 420, overflowWrap: 'anywhere' }}>
              Pick the tennis job first. The tier decision follows naturally.
            </div>
          </div>
          <Link href="/pricing" style={{ ...buttonPrimary, minHeight: 40, paddingInline: 15, width: isMobile ? '100%' : undefined }}>
            Compare tiers
          </Link>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          {roleChoices.map((item) => {
            const theme = getTierTheme(item.planId)
            return (
              <Link
                key={item.planId}
                href={item.href}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isSmallMobile
                    ? 'minmax(0, 1fr)'
                    : 'minmax(min(100%, 126px), 126px) minmax(0, 1fr) minmax(0, auto)',
                  gap: 12,
                  alignItems: 'center',
                  minHeight: isSmallMobile ? 92 : 72,
                  padding: isSmallMobile ? 12 : 11,
                  borderRadius: 16,
                  border: '1px solid rgba(116,190,255,0.10)',
                  borderLeft: `3px solid ${theme.priceColor}`,
                  background: 'color-mix(in srgb, var(--surface-soft) 94%, var(--foreground) 6%)',
                  color: 'inherit',
                  textDecoration: 'none',
                  minWidth: 0,
                }}
              >
                <span style={{ ...theme.tierBadge, width: 'fit-content' }}>{item.label}</span>
                <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <strong style={{ color: 'var(--foreground-strong)', fontSize: 14, lineHeight: 1.12 }}>{item.title}</strong>
                  <span style={{ color: 'var(--muted-strong)', fontSize: 12, lineHeight: 1.35 }}>{item.text}</span>
                </span>
                <span style={{ ...snapshotPanelLabelStyle, color: theme.priceColor, overflowWrap: 'anywhere' }}>{item.cta}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Kept temporarily as a fallback while the command-center homepage is reviewed.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TierSection({
  planId,
  stage,
  label,
  headline,
  copy,
  bullets,
  secondaryCta,
  snapshot,
  featured = false,
  featuredNote,
  access,
  authenticated,
  reverse = false,
}: TierSectionConfig & { access: ProductAccessState; authenticated: boolean; reverse?: boolean }) {
  const { isTablet, isSmallMobile } = useViewportBreakpoints()
  const plan = getPricingPlan(planId)
  const theme = getTierTheme(planId)
  const accessPresentation = getTierAccessPresentation(planId, access, authenticated)

  return (
    <section
      style={{
        ...surfaceCardStrong,
        position: 'relative',
        padding: 0,
        overflow: 'hidden',
        border: theme.shellBorder,
        boxShadow: theme.shellShadow,
        background: theme.shellBackground,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: theme.chapterGlow,
          opacity: 0.46,
        }}
      />
      <div
        style={{
          position: 'absolute',
          insetInline: 0,
          top: 0,
          height: 2,
          background: `linear-gradient(90deg, ${theme.priceColor} 0%, transparent 72%)`,
          opacity: 0.72,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(min(100%, 360px), 0.96fr) minmax(min(100%, 320px), 1.08fr)',
          gap: 0,
          minWidth: 0,
        }}
      >
        <div
          style={{
            order: isTablet ? 1 : reverse ? 2 : 1,
            padding: isSmallMobile ? 16 : 18,
            display: 'grid',
            gap: 10,
            alignContent: 'start',
            background: theme.contentBackground,
          }}
        >
          <TiqFeatureIcon name={getPlanIcon(planId)} size="lg" variant="surface" />
          <div style={tierHeaderWrapStyle}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <span style={theme.tierBadge}>{label}</span>
              {accessPresentation.active ? <span style={activeTierBadgeStyle}>Active</span> : plan.badge ? <span style={mostPopularBadgeStyle}>{plan.badge}</span> : null}
            </div>
            <span style={{ ...tierPriceStyle, color: theme.priceColor }}>{accessPresentation.priceLabel}</span>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ color: theme.accentLabel, fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {stage}
            </div>
            <h3
              style={{
                margin: 0,
                color: 'var(--foreground-strong)',
                fontSize: 'clamp(1.55rem, 2.2vw, 2.25rem)',
                lineHeight: 1.04,
                letterSpacing: '-0.04em',
                fontWeight: 900,
                maxWidth: 560,
              }}
            >
              {headline}
            </h3>
            <p
              style={{
                margin: 0,
                color: 'var(--muted-strong)',
                fontSize: 13,
                lineHeight: 1.55,
                maxWidth: 560,
              }}
            >
              {copy}
            </p>
          </div>

          <div style={{ display: 'grid', gap: 7 }}>
            {bullets.map((bullet) => (
              <div key={bullet} style={bulletRowStyle}>
                <span style={{ ...bulletDotStyle, background: `linear-gradient(135deg, ${theme.priceColor} 0%, rgba(255,255,255,0.98) 100%)` }} />
                <span>{bullet}</span>
              </div>
            ))}
          </div>

          {featured && featuredNote ? (
            <div
              style={{
                ...featuredNoteCardStyle,
                border: '1px solid rgba(116,190,255,0.10)',
                background: 'color-mix(in srgb, var(--surface-soft) 94%, var(--foreground) 6%)',
              }}
            >
              <div style={{ ...featuredNoteLabelStyle, color: theme.accentLabel }}>Why this tier matters</div>
              <div style={featuredNoteTextStyle}>{featuredNote}</div>
            </div>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link
              href={accessPresentation.primaryCta.href}
              style={featured ? { ...theme.primaryButton, boxShadow: '0 16px 28px rgba(155, 225, 29, 0.18)' } : theme.primaryButton}
            >
              {accessPresentation.primaryCta.label}
            </Link>
              {secondaryCta && !accessPresentation.active ? (
                <Link href={secondaryCta.href} style={getTierSecondaryButton(theme)}>
                  {secondaryCta.label}
                </Link>
              ) : null}
          </div>

          <div style={{ ...tierMetaCardStyle, border: '1px solid rgba(116,190,255,0.10)', background: 'color-mix(in srgb, var(--surface-soft) 94%, var(--foreground) 6%)' }}>
            <div style={{ ...tierMetaLabelStyle, color: theme.accentLabel }}>Problem solved</div>
            <div style={tierMetaTextStyle}>{plan.problem}</div>
            <div style={{ ...tierMetaTextStyle, color: 'var(--foreground-strong)' }}>{plan.outcome}</div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: 'var(--muted-strong)',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                width: 36,
                height: 1,
                background: theme.priceColor,
                opacity: 0.7,
              }}
            />
            Unlocked experience
          </div>
        </div>

        <div
          style={{
            order: isTablet ? 2 : reverse ? 1 : 2,
            padding: isSmallMobile ? 16 : 18,
            background: theme.previewBackground,
            borderLeft: isTablet ? 'none' : reverse ? 'none' : theme.previewDivider,
            borderRight: isTablet ? 'none' : reverse ? theme.previewDivider : 'none',
            borderTop: isTablet ? theme.previewDivider : 'none',
            display: 'grid',
            alignContent: 'center',
          }}
        >
          {snapshot}
        </div>
      </div>
    </section>
  )
}

function FreeSnapshot() {
  const { isSmallMobile } = useViewportBreakpoints()

  return (
    <SnapshotShell planId="free" title="Explore entry" subtitle="Search, profile, availability, lineup visibility">
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={searchInputShellStyle}>
          <SearchIcon />
          <span style={{ color: colors.mutedStrong, fontSize: 14 }}>Search players, teams, leagues, or matches</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Players', 'Teams', 'Leagues', 'My Lab'].map((item) => (
            <span key={item} style={snapshotChipStyle}>
              {item}
            </span>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: 10, minWidth: 0 }}>
          <SnapshotCard title="Profile" value="Ready to join" text="Create your player profile and join your team." />
          <SnapshotCard title="Availability" value="2 taps" text="Set in, out, or tentative before lineup decisions start." accent="green" />
        </div>

        <div style={listShellStyle}>
          <ListRow title="Posted lineup" meta="View-only access on Free" trailing="Ready" />
          <ListRow title="My next match" meta="Saturday, 9:00 AM" trailing="Upcoming" />
        </div>
      </div>
    </SnapshotShell>
  )
}

function PlayerPlusSnapshot() {
  const { isMobile, isSmallMobile } = useViewportBreakpoints()

  return (
    <SnapshotShell planId="player_plus" title="Player insight" subtitle="Role fit, projections, recent form, and matchup context">
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 10, minWidth: 0 }}>
          <SnapshotCard title="TIQ" value="4.48" text="Current form rating" accent="green" />
          <SnapshotCard title="Best fit" value="D2" text="Where you should play" accent="blue" />
          <SnapshotCard title="Projection" value="63%" text="Match win estimate" accent="blue" />
        </div>

        <div style={snapshotPanelStyle}>
          <div style={{ ...snapshotPanelLabelStyle, color: 'var(--brand-green)' }}>Where should I play?</div>
          <div style={{ color: 'var(--foreground-strong)', fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em' }}>
            Your best edge is doubles this week.
          </div>
          <div style={{ color: 'var(--muted-strong)', fontSize: 13, lineHeight: 1.65 }}>
            Higher doubles fit, steadier recent form, and better synergy with similar TIQ pair profiles.
          </div>
        </div>

        <div style={snapshotPanelStyle}>
          <div style={{ ...snapshotPanelLabelStyle, color: 'var(--brand-blue-2)' }}>Recent form and matchup context</div>
          <div style={{ color: 'var(--foreground-strong)', fontSize: 16, fontWeight: 900 }}>
            Trending up, with the clearest edge when the pace stays controlled.
          </div>
          <div style={{ color: 'var(--muted-strong)', fontSize: 13, lineHeight: 1.6 }}>
            Recent TIQ movement and available opponent context both point to doubles as the stronger play this week.
          </div>
        </div>
      </div>
    </SnapshotShell>
  )
}

function CaptainSnapshot() {
  const { isMobile, isSmallMobile } = useViewportBreakpoints()

  return (
    <SnapshotShell
      planId="captain"
      title="Team Hub"
      subtitle="Availability, lineup builder, scenarios, projections, and team messaging"
      featured
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 10, minWidth: 0 }}>
          <SnapshotCard title="Availability" value="8 / 10" text="Players confirmed" accent="green" />
          <SnapshotCard title="Best lineup" value="71%" text="Projected win rate" accent="green" />
          <SnapshotCard title="Scenario delta" value="+8%" text="Compared with another option" accent="blue" />
        </div>

        <div style={{ ...snapshotPanelStyle, gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ ...snapshotPanelLabelStyle, color: 'var(--foreground)' }}>Projected lineup</div>
            <span style={{ ...badgeGreen, width: 'fit-content' }}>Captain</span>
          </div>
          <div style={lineupShellStyle}>
            <LineupRow label="S1" value="J. Walker" status="Available" projection="66%" />
            <LineupRow label="S2" value="L. Carter" status="Available" projection="59%" />
            <LineupRow label="D1" value="Mei + Brooks" status="Available" projection="74%" />
            <LineupRow label="D2" value="Hart + Lyons" status="Tentative" projection="68%" />
            <LineupRow label="D3" value="Cole + Ramos" status="Available" projection="71%" />
          </div>
        </div>

        <div style={{ ...snapshotPanelStyle, gap: 10 }}>
          <div style={{ ...snapshotPanelLabelStyle, color: 'var(--brand-blue-2)' }}>Captain signals</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <CaptainSignalRow title="Availability check" text="Two tentative players affect doubles." tone="warn" />
            <CaptainSignalRow title="Best projected court" text="D1 is the clearest swing court in the current recommended lineup." tone="good" />
            <CaptainSignalRow title="Team message" text="Lineup, arrival time, and reminders can go out in one update." tone="info" />
          </div>
        </div>
      </div>
    </SnapshotShell>
  )
}

function LeagueSnapshot() {
  const { isSmallMobile } = useViewportBreakpoints()

  return (
    <SnapshotShell planId="league" title="League Office" subtitle="Standings, schedule, teams, and season operations">
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: 10, minWidth: 0 }}>
          <SnapshotCard title="Teams" value="10" text="Entered this season" accent="blue" />
          <SnapshotCard title="Matches" value="36" text="Scheduled and tracked" accent="green" />
        </div>

        <div style={listShellStyle}>
          <div style={{ ...snapshotPanelLabelStyle, color: 'var(--brand-blue-2)', marginBottom: 4 }}>Standings</div>
          <StandingsRow rank="1" team="Southside Aces" record="5-1" points="16" />
          <StandingsRow rank="2" team="Wily Wolverines" record="4-2" points="14" />
          <StandingsRow rank="3" team="Northline Volley" record="4-2" points="13" />
          <StandingsRow rank="4" team="Baseline Union" record="3-3" points="11" />
        </div>

        <div style={snapshotPanelStyle}>
          <div style={{ ...snapshotPanelLabelStyle, color: 'var(--brand-green)' }}>Upcoming schedule</div>
          <ListRow title="Wolverines vs Aces" meta="Saturday - Court 3 - 9:00 AM" trailing="Ready" />
          <ListRow title="Union vs Spin Club" meta="Saturday - Court 5 - 10:30 AM" trailing="Posted" />
        </div>
      </div>
    </SnapshotShell>
  )
}

function SnapshotShell({
  planId,
  title,
  subtitle,
  children,
  featured = false,
}: {
  planId: PricingPlanId
  title: string
  subtitle: string
  children: ReactNode
  featured?: boolean
}) {
  const { isSmallMobile } = useViewportBreakpoints()
  const theme = getTierTheme(planId)
  return (
    <div
      style={{
        ...surfaceCard,
        position: 'relative',
        padding: isSmallMobile ? 15 : 16,
        display: 'grid',
        gap: 12,
        background: featured ? theme.previewBackground : theme.contentBackground,
        border: '1px solid rgba(116,190,255,0.10)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: theme.chapterGlow,
          opacity: 0.24,
        }}
      />
      <div style={{ display: 'grid', gap: 5 }}>
        <div style={{ ...snapshotPanelLabelStyle, color: theme.accentLabel }}>{title}</div>
        <div style={{ color: 'var(--foreground-strong)', fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{subtitle}</div>
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}

function SnapshotCard({
  title,
  value,
  text,
  accent = 'slate',
}: {
  title: string
  value: string
  text: string
  accent?: 'green' | 'blue' | 'slate'
}) {
  const tone =
    accent === 'green'
      ? 'color-mix(in srgb, var(--surface-soft) 88%, var(--brand-green) 12%)'
      : accent === 'blue'
        ? 'color-mix(in srgb, var(--surface-soft) 88%, var(--brand-blue-2) 12%)'
        : 'color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%)'

  const border =
    accent === 'green'
      ? '1px solid rgba(155,225,29,0.18)'
      : accent === 'blue'
        ? '1px solid rgba(116,190,255,0.16)'
        : '1px solid rgba(116,190,255,0.10)'

  const labelColor =
    accent === 'green'
      ? 'color-mix(in srgb, var(--brand-green) 78%, var(--foreground-strong) 22%)'
      : accent === 'blue'
        ? 'color-mix(in srgb, var(--brand-blue) 74%, var(--foreground-strong) 26%)'
        : 'var(--muted-strong)'

  return (
    <div
      style={{
        display: 'grid',
        gap: 6,
        padding: 12,
        borderRadius: 15,
        background: tone,
        border,
      }}
    >
      <div style={{ color: labelColor, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {title}
      </div>
      <div style={{ color: 'var(--foreground-strong)', fontSize: 22, fontWeight: 900, letterSpacing: '-0.04em' }}>{value}</div>
      <div style={{ color: 'var(--foreground)', fontSize: 12, lineHeight: 1.55 }}>{text}</div>
    </div>
  )
}

function CaptainSignalRow({
  title,
  text,
  tone,
}: {
  title: string
  text: string
  tone: 'warn' | 'good' | 'info'
}) {
  const chipStyle =
    tone === 'warn'
      ? signalWarnChipStyle
      : tone === 'good'
        ? signalGoodChipStyle
        : signalInfoChipStyle

  const chipLabel = tone === 'warn' ? 'Watch' : tone === 'good' ? 'Strong' : 'Ready'

  return (
    <div style={captainSignalRowStyle}>
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ color: 'var(--foreground-strong)', fontSize: 13, fontWeight: 800 }}>{title}</div>
        <div style={{ color: 'var(--muted-strong)', fontSize: 12, lineHeight: 1.55 }}>{text}</div>
      </div>
      <span style={chipStyle}>{chipLabel}</span>
    </div>
  )
}

function LineupRow({
  label,
  value,
  status,
  projection,
}: {
  label: string
  value: string
  status: string
  projection: string
}) {
  const { isSmallMobile } = useViewportBreakpoints()
  const statusStyle =
    status === 'Available'
      ? badgeGreen
      : status === 'Tentative'
        ? badgeBlue
        : badgeSlate

  const projectionChipStyle: CSSProperties = {
    width: 'fit-content',
    minHeight: 28,
    padding: '0 12px',
    borderRadius: 999,
    border: '1px solid rgba(155,225,29,0.24)',
    background:
      'color-mix(in srgb, var(--surface-soft) 82%, var(--brand-green) 18%)',
    color: 'var(--foreground-strong)',
    fontSize: 13,
    fontWeight: 900,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: '-0.01em',
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isSmallMobile
          ? 'minmax(0, 44px) minmax(0, 1fr)'
          : 'minmax(0, 52px) minmax(0, 1fr) minmax(0, auto) minmax(0, auto)',
        gap: 10,
        alignItems: 'center',
        minWidth: 0,
        padding: 12,
        borderRadius: 15,
        border: '1px solid rgba(116,190,255,0.1)',
        background: 'color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%)',
      }}
    >
      <div style={{ color: 'var(--foreground)', fontWeight: 900, minWidth: 0, overflowWrap: 'anywhere' }}>{label}</div>
      <div style={{ color: 'var(--foreground-strong)', fontSize: 14, fontWeight: 800, minWidth: 0, overflowWrap: 'anywhere' }}>{value}</div>
      {isSmallMobile ? (
        <>
          <span style={{ ...statusStyle, width: 'fit-content', minHeight: 28, gridColumn: '2 / 3' }}>{status}</span>
          <div style={{ ...projectionChipStyle, gridColumn: '2 / 3' }}>{projection}</div>
        </>
      ) : (
        <>
          <span style={{ ...statusStyle, width: 'fit-content', minHeight: 28 }}>{status}</span>
          <div style={projectionChipStyle}>{projection}</div>
        </>
      )}
    </div>
  )
}

function ListRow({
  title,
  meta,
  trailing,
}: {
  title: string
  meta: string
  trailing: string
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto)',
        gap: 12,
        alignItems: 'center',
        minWidth: 0,
        padding: 12,
        borderRadius: 15,
        border: '1px solid rgba(116,190,255,0.1)',
        background: 'color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%)',
      }}
    >
      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        <div style={{ color: 'var(--foreground-strong)', fontSize: 14, fontWeight: 800 }}>{title}</div>
        <div style={{ color: 'var(--muted-strong)', fontSize: 12, lineHeight: 1.55 }}>{meta}</div>
      </div>
      <div style={{ ...badgeBlue, width: 'fit-content', overflowWrap: 'anywhere' }}>{trailing}</div>
    </div>
  )
}

function StandingsRow({
  rank,
  team,
  record,
  points,
}: {
  rank: string
  team: string
  record: string
  points: string
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 28px) minmax(0, 1fr) minmax(0, auto) minmax(0, auto)',
        gap: 10,
        alignItems: 'center',
        minWidth: 0,
        padding: 10,
        borderRadius: 14,
      }}
    >
      <div style={{ color: '#9be11d', fontWeight: 900 }}>{rank}</div>
      <div style={{ color: 'var(--foreground-strong)', fontSize: 14, fontWeight: 800, minWidth: 0, overflowWrap: 'anywhere' }}>{team}</div>
      <div style={{ color: 'var(--muted-strong)', fontSize: 12, fontWeight: 800 }}>{record}</div>
      <div style={{ color: 'var(--foreground)', fontSize: 12, fontWeight: 900 }}>{points} pts</div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M8.6 14.2a5.6 5.6 0 1 1 0-11.2 5.6 5.6 0 0 1 0 11.2Zm7 1.1-3.1-3.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

const commandPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 16,
  borderRadius: 10,
  border: '1px solid #e2eaf4',
  background: '#ffffff',
  color: '#07142c',
  boxShadow: '0 12px 32px rgba(10, 28, 58, 0.06)',
}

const commandPanelHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'start',
  gap: 12,
  minWidth: 0,
}

const commandPanelTitleStyle: CSSProperties = {
  margin: 0,
  color: '#07142c',
  fontSize: 16,
  lineHeight: 1.15,
  fontWeight: 950,
  letterSpacing: '-0.02em',
}

const commandLogoMarkStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 72%, var(--brand-green-2) 28%)',
  boxShadow: '0 0 0 5px rgba(255,255,255,0.20)',
}

const commandRailMiniCtaStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  background: '#ffffff',
  color: '#061632',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 950,
}

const commandGhostButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 14px',
  borderRadius: 9,
  border: '1px solid #d7e0ec',
  background: '#ffffff',
  color: '#07142c',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 900,
}

const commandPrimaryButtonStyle: CSSProperties = {
  ...commandGhostButtonStyle,
  border: '1px solid #07142c',
  background: '#07142c',
  color: '#ffffff',
}

const commandSearchShellStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '18px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
  minHeight: 50,
  minWidth: 0,
  padding: '0 14px',
  borderRadius: 10,
  border: '1px solid #d7e0ec',
  background: '#ffffff',
  color: '#69778d',
  boxShadow: '0 10px 24px rgba(10, 28, 58, 0.04)',
}

const commandSearchInputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  color: '#07142c',
  font: 'inherit',
  fontSize: 14,
}

const commandFilterButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: 50,
  padding: '0 16px',
  borderRadius: 10,
  border: '1px solid #07142c',
  background: '#ffffff',
  color: '#07142c',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 950,
}

const clubCrestStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 38,
  height: 38,
  borderRadius: 9,
  border: '1px solid rgba(255,255,255,0.34)',
  background: 'linear-gradient(135deg, #fff5d8 0%, #e6b64a 100%)',
  color: '#061632',
  fontSize: 11,
  fontWeight: 950,
}

const railIconDotStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 30,
  height: 30,
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.20)',
  color: '#ffffff',
  fontSize: 11,
  fontWeight: 950,
}

const rangePillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 24,
  padding: '0 8px',
  borderRadius: 999,
  background: '#eef2f7',
  color: '#526177',
  fontSize: 11,
  fontWeight: 850,
}

const activeRangePillStyle: CSSProperties = {
  background: '#e6f0ff',
  color: '#1469db',
}

const blueRatingPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 24,
  minWidth: 34,
  padding: '0 7px',
  borderRadius: 7,
  background: '#1769e8',
  color: '#ffffff',
  fontSize: 12,
  fontWeight: 950,
}

const outlineBlueButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 14px',
  borderRadius: 9,
  border: '1px solid #1769e8',
  color: '#07142c',
  background: '#ffffff',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 950,
}

const plainBlueLinkStyle: CSSProperties = {
  color: '#1469db',
  fontSize: 13,
  fontWeight: 850,
  textDecoration: 'none',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const standingsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '24px minmax(0, 1fr) 28px 28px 44px 32px',
  gap: 8,
  alignItems: 'center',
  minHeight: 30,
  padding: '0 6px',
  color: '#526177',
  fontSize: 12,
}

const chipLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid var(--card-border-soft)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 92%, var(--brand-blue-2) 8%) 0%, color-mix(in srgb, var(--surface-soft) 98%, var(--foreground) 2%) 100%)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 800,
  boxShadow: 'var(--shadow-soft)',
}

const searchInputShellStyle: CSSProperties = {
  ...surfaceCard,
  minHeight: 50,
  padding: '0 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  border: '1px solid rgba(116,190,255,0.16)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 92%, var(--brand-blue-2) 8%) 0%, color-mix(in srgb, var(--surface-soft) 98%, var(--foreground) 2%) 100%)',
}

const snapshotChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.12)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 92%, var(--brand-blue-2) 8%) 0%, color-mix(in srgb, var(--surface-soft) 98%, var(--foreground) 2%) 100%)',
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 800,
}

const snapshotPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%)',
}

const snapshotPanelLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const listShellStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 10,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%)',
}

const lineupShellStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const tierPriceStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '-0.01em',
  minWidth: 0,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  lineHeight: 1.08,
  textAlign: 'right',
}

const compactPriceLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 950,
  lineHeight: 1.08,
  textAlign: 'right',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  wordBreak: 'normal',
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

const fullCourtValueStripStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const fullCourtValueChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(15,23,42,0.45)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 900,
}

const fullCourtPrimaryCtaStyle: CSSProperties = {
  ...buttonPrimary,
  border: '1px solid rgba(155,225,29,0.42)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.32), rgba(116,190,255,0.18))',
  boxShadow: '0 18px 40px rgba(155,225,29,0.14)',
}

const mostPopularBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 26,
  padding: '0 9px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const activeTierBadgeStyle: CSSProperties = {
  ...mostPopularBadgeStyle,
  border: '1px solid rgba(155,225,29,0.30)',
  background: 'color-mix(in srgb, var(--brand-green) 18%, var(--surface-soft) 82%)',
  color: 'var(--foreground-strong)',
  width: 'fit-content',
}

const profileLinkNoticeStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr) minmax(0, auto)',
  gap: 12,
  alignItems: 'center',
  width: 'min(100%, 720px)',
  marginTop: 12,
  padding: 12,
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 30%, rgba(116,190,255,0.18) 70%)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.13), rgba(255,255,255,0.055))',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
  minWidth: 0,
  maxWidth: '100%',
  boxSizing: 'border-box',
}

const profileLinkNoticeTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 950,
  lineHeight: 1.15,
}

const profileLinkNoticeTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const profileLinkNoticeCtaStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  background: 'var(--brand-green)',
  color: '#061226',
  fontSize: 12,
  fontWeight: 950,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const homeLockChipStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 36%, var(--shell-panel-border) 64%)',
  color: 'var(--foreground-strong)',
  flexShrink: 0,
}

const bulletRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 12px) minmax(0, 1fr)',
  gap: 10,
  alignItems: 'start',
  minWidth: 0,
  color: 'var(--foreground)',
  fontSize: 14,
  lineHeight: 1.68,
}

const bulletDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  marginTop: 7,
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
}

const tierMetaCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 11,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%)',
}

const tierMetaLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const tierMetaTextStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 700,
}

const tierHeaderWrapStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
}

function getTierTheme(planId: PricingPlanId): TierTheme {
  switch (planId) {
    case 'player_plus':
      return {
        shellBorder: '1px solid rgba(74,163,255,0.22)',
        shellShadow: '0 24px 56px rgba(37,91,227,0.10)',
        shellBackground:
          'linear-gradient(135deg, color-mix(in srgb, var(--surface-strong) 92%, var(--brand-blue) 8%) 0%, color-mix(in srgb, var(--surface) 94%, var(--brand-blue-2) 6%) 100%)',
        chapterGlow:
          'radial-gradient(circle at 14% 16%, color-mix(in srgb, var(--brand-blue-2) 14%, transparent) 0%, transparent 34%), radial-gradient(circle at 88% 82%, color-mix(in srgb, var(--brand-blue) 12%, transparent) 0%, transparent 30%)',
        contentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 96%, var(--brand-blue) 4%) 0%, color-mix(in srgb, var(--surface) 96%, var(--brand-blue-2) 4%) 100%)',
        previewBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 94%, var(--brand-blue) 6%) 0%, color-mix(in srgb, var(--surface) 94%, var(--brand-blue-2) 6%) 100%)',
        previewDivider: '1px solid rgba(74,163,255,0.12)',
        tierBadge: {
          ...badgeBlue,
          color: 'var(--foreground-strong)',
          border: '1px solid rgba(74,163,255,0.22)',
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 80%, var(--brand-blue) 20%) 0%, color-mix(in srgb, var(--surface-soft) 92%, var(--brand-blue-2) 8%) 100%)',
        },
        priceColor: 'var(--brand-blue)',
        numberColor: 'color-mix(in srgb, var(--brand-blue) 72%, var(--foreground-strong) 28%)',
        accentLabel: 'color-mix(in srgb, var(--brand-blue) 72%, var(--foreground-strong) 28%)',
        accentBorder: '1px solid rgba(74,163,255,0.18)',
        accentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 80%, var(--brand-blue) 20%) 0%, color-mix(in srgb, var(--surface-soft) 86%, var(--brand-blue-2) 14%) 100%)',
        accentText: 'var(--foreground-strong)',
        primaryButton: {
          ...buttonPrimary,
          background: 'linear-gradient(135deg, #255be3 0%, #74beff 100%)',
          border: '1px solid rgba(116,190,255,0.34)',
          color: 'var(--foreground-strong)',
          boxShadow: '0 16px 30px rgba(37,91,227,0.20)',
        },
      }
    case 'captain':
      return {
        shellBorder: '1px solid rgba(155,225,29,0.24)',
        shellShadow: '0 26px 60px rgba(155,225,29,0.10)',
        shellBackground:
          'linear-gradient(135deg, color-mix(in srgb, var(--surface-strong) 90%, var(--brand-green) 10%) 0%, color-mix(in srgb, var(--surface) 94%, var(--brand-blue) 6%) 100%)',
        chapterGlow:
          'radial-gradient(circle at 16% 14%, color-mix(in srgb, var(--brand-green) 16%, transparent) 0%, transparent 34%), radial-gradient(circle at 84% 80%, color-mix(in srgb, var(--brand-blue-2) 12%, transparent) 0%, transparent 28%)',
        contentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 96%, var(--brand-blue) 4%) 0%, color-mix(in srgb, var(--surface) 94%, var(--brand-green) 6%) 100%)',
        previewBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 92%, var(--brand-green) 8%) 0%, color-mix(in srgb, var(--surface) 94%, var(--brand-blue) 6%) 100%)',
        previewDivider: '1px solid rgba(155,225,29,0.10)',
        tierBadge: {
          ...badgeGreen,
          color: 'var(--foreground-strong)',
          border: '1px solid rgba(155,225,29,0.22)',
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 78%, var(--brand-green) 22%) 0%, color-mix(in srgb, var(--surface-soft) 90%, var(--brand-green) 10%) 100%)',
        },
        priceColor: 'var(--brand-green)',
        numberColor: 'color-mix(in srgb, var(--brand-green) 76%, var(--foreground-strong) 24%)',
        accentLabel: 'color-mix(in srgb, var(--brand-green) 76%, var(--foreground-strong) 24%)',
        accentBorder: '1px solid rgba(155,225,29,0.18)',
        accentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 78%, var(--brand-green) 22%) 0%, color-mix(in srgb, var(--surface-soft) 84%, var(--brand-blue) 16%) 100%)',
        accentText: 'var(--foreground-strong)',
        primaryButton: {
          ...buttonPrimary,
          boxShadow: '0 18px 34px rgba(155, 225, 29, 0.22)',
        },
      }
    case 'league':
      return {
        shellBorder: '1px solid rgba(245,158,11,0.22)',
        shellShadow: '0 24px 56px rgba(245,158,11,0.10)',
        shellBackground:
          'linear-gradient(135deg, color-mix(in srgb, var(--surface-strong) 92%, #f59e0b 8%) 0%, color-mix(in srgb, var(--surface) 96%, #fcd34d 4%) 100%)',
        chapterGlow:
          'radial-gradient(circle at 16% 18%, color-mix(in srgb, #f59e0b 12%, transparent) 0%, transparent 34%), radial-gradient(circle at 86% 80%, color-mix(in srgb, #fcd34d 10%, transparent) 0%, transparent 28%)',
        contentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 96%, #f59e0b 4%) 0%, color-mix(in srgb, var(--surface) 96%, var(--brand-blue) 4%) 100%)',
        previewBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 94%, #f59e0b 6%) 0%, color-mix(in srgb, var(--surface) 96%, #fcd34d 4%) 100%)',
        previewDivider: '1px solid rgba(245,158,11,0.12)',
        tierBadge: {
          ...badgeSlate,
          color: 'var(--foreground-strong)',
          border: '1px solid rgba(245,158,11,0.22)',
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 78%, #f59e0b 22%) 0%, color-mix(in srgb, var(--surface-soft) 90%, #fcd34d 10%) 100%)',
        },
        priceColor: '#f59e0b',
        numberColor: 'color-mix(in srgb, #f59e0b 74%, var(--foreground-strong) 26%)',
        accentLabel: 'color-mix(in srgb, #f59e0b 74%, var(--foreground-strong) 26%)',
        accentBorder: '1px solid rgba(245,158,11,0.18)',
        accentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 78%, #f59e0b 22%) 0%, color-mix(in srgb, var(--surface-soft) 86%, #fcd34d 14%) 100%)',
        accentText: 'var(--foreground-strong)',
        primaryButton: {
          ...buttonPrimary,
          background: 'linear-gradient(135deg, #f59e0b 0%, #fcd34d 100%)',
          border: '1px solid rgba(245,158,11,0.34)',
          color: '#111827',
          boxShadow: '0 16px 30px rgba(245,158,11,0.20)',
        },
      }
    case 'free':
    default:
      return {
        shellBorder: '1px solid rgba(148,163,184,0.18)',
        shellShadow: 'var(--shadow-card)',
        shellBackground:
          'linear-gradient(135deg, color-mix(in srgb, var(--surface-strong) 92%, var(--brand-blue) 8%) 0%, color-mix(in srgb, var(--surface) 96%, var(--foreground) 4%) 100%)',
        chapterGlow:
          'radial-gradient(circle at 16% 16%, color-mix(in srgb, var(--brand-blue-2) 12%, transparent) 0%, transparent 34%), radial-gradient(circle at 84% 84%, color-mix(in srgb, var(--foreground) 8%, transparent) 0%, transparent 30%)',
        contentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 96%, var(--brand-blue) 4%) 0%, color-mix(in srgb, var(--surface) 98%, var(--foreground) 2%) 100%)',
        previewBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 94%, var(--brand-blue-2) 6%) 0%, color-mix(in srgb, var(--surface) 96%, var(--foreground) 4%) 100%)',
        previewDivider: '1px solid rgba(116,190,255,0.08)',
        tierBadge: {
          ...badgeSlate,
          color: 'var(--foreground-strong)',
          background: 'var(--surface-soft)',
        },
        priceColor: 'var(--foreground)',
        numberColor: 'color-mix(in srgb, var(--brand-blue) 72%, var(--foreground-strong) 28%)',
        accentLabel: 'color-mix(in srgb, var(--brand-blue) 72%, var(--foreground-strong) 28%)',
        accentBorder: '1px solid rgba(116,190,255,0.12)',
        accentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 92%, var(--brand-blue-2) 8%) 0%, color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%) 100%)',
        accentText: 'var(--foreground-strong)',
        primaryButton: buttonPrimary,
      }
  }
}

const featuredNoteCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.18)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 80%, var(--brand-green) 20%) 0%, color-mix(in srgb, var(--surface-soft) 88%, var(--brand-blue) 12%) 100%)',
}

const featuredNoteLabelStyle: CSSProperties = {
  color: 'color-mix(in srgb, var(--brand-green) 78%, var(--foreground-strong) 22%)',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const featuredNoteTextStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 700,
}

const captainSignalRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto)',
  gap: 10,
  alignItems: 'center',
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.08)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 90%, var(--brand-blue-2) 10%) 0%, color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%) 100%)',
}

const signalWarnChipStyle: CSSProperties = {
  ...badgeSlate,
  width: 'fit-content',
  border: '1px solid rgba(245, 158, 11, 0.22)',
  background: 'rgba(245, 158, 11, 0.12)',
  color: 'var(--foreground-strong)',
}

const signalGoodChipStyle: CSSProperties = {
  ...badgeGreen,
  width: 'fit-content',
}

const signalInfoChipStyle: CSSProperties = {
  ...badgeBlue,
  width: 'fit-content',
}

function getTierSecondaryButton(theme: TierTheme): CSSProperties {
  return {
    ...buttonGhost,
    border: theme.accentBorder,
    background: theme.accentBackground,
    color: theme.accentText,
  }
}
