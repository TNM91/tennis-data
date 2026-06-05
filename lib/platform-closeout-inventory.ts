import type { MembershipTierId } from './product-story'

export type PlatformCloseoutTierId = MembershipTierId | 'admin_internal'

export type PlatformCapabilityStatus = 'backend-backed' | 'local' | 'mock' | 'manual' | 'blocked'

export type PlatformVerificationKind = 'automated' | 'manual' | 'needs-account' | 'blocked'

export type PlatformCustomerJourneyStage =
  | 'discover'
  | 'unlock'
  | 'plan'
  | 'act'
  | 'track'
  | 'review'
  | 'share'
  | 'operate'
  | 'return'
  | 'admin'

export type PlatformCloseoutFeature = {
  id: string
  tierId: PlatformCloseoutTierId
  label: string
  route: string
  journeyStage: PlatformCustomerJourneyStage
  painPoint: string
  job: string
  status: PlatformCapabilityStatus
  verification: {
    kind: PlatformVerificationKind
    script?: string
    note: string
  }
  nextCloseoutStep: string
}

export const PLATFORM_CLOSEOUT_TIER_LABELS: Record<PlatformCloseoutTierId, string> = {
  free: 'Free',
  player_plus: 'Player',
  coach: 'Coach',
  captain: 'Captain',
  league: 'League',
  full_court: 'Full-Court',
  admin_internal: 'Admin/Internal',
}

export const PLATFORM_CAPABILITY_STATUSES: PlatformCapabilityStatus[] = ['backend-backed', 'local', 'mock', 'manual', 'blocked']

export const PLATFORM_VERIFICATION_KINDS: PlatformVerificationKind[] = ['automated', 'manual', 'needs-account', 'blocked']

export const PLATFORM_CUSTOMER_JOURNEY_STAGES: PlatformCustomerJourneyStage[] = [
  'discover',
  'unlock',
  'plan',
  'act',
  'track',
  'review',
  'share',
  'operate',
  'return',
  'admin',
]

export const PLATFORM_CUSTOMER_JOURNEY_STAGE_LABELS: Record<PlatformCustomerJourneyStage, string> = {
  discover: 'Discover',
  unlock: 'Unlock',
  plan: 'Plan',
  act: 'Act',
  track: 'Track',
  review: 'Review',
  share: 'Share',
  operate: 'Operate',
  return: 'Return',
  admin: 'Admin',
}

export const PLATFORM_CLOSEOUT_FEATURES: PlatformCloseoutFeature[] = [
  {
    id: 'free-public-explore',
    tierId: 'free',
    label: 'Public Explore',
    route: '/explore',
    journeyStage: 'discover',
    painPoint: 'Visitors do not know where to start or how to understand the tennis landscape around them.',
    job: 'Help visitors find players, teams, leagues, rankings, and public tennis context.',
    status: 'backend-backed',
    verification: {
      kind: 'automated',
      script: 'scripts/verify-platform-routes.mjs',
      note: 'Route smoke covers public entry and public tennis discovery routes when browser checks run.',
    },
    nextCloseoutStep: 'Run live route smoke and spot-check public search/result pages with seeded data.',
  },
  {
    id: 'free-data-assist-entry',
    tierId: 'free',
    label: 'Data Assist Entry',
    route: '/data-assist',
    journeyStage: 'act',
    painPoint: 'Users have updated scorecards, schedules, or rosters but no clear way to turn them into trusted platform context.',
    job: 'Let users contribute TennisLink exports when platform data needs to refresh.',
    status: 'manual',
    verification: {
      kind: 'manual',
      note: 'Import review depends on file fixtures and admin review behavior beyond route availability.',
    },
    nextCloseoutStep: 'Run a scorecard/schedule upload fixture and confirm review status, import preview, and admin handoff.',
  },
  {
    id: 'player-my-lab',
    tierId: 'player_plus',
    label: 'My Lab',
    route: '/mylab',
    journeyStage: 'return',
    painPoint: 'Players see tennis data in fragments and need one personal home that tells them what matters next.',
    job: 'Give the player a personalized tennis home with current context and next actions.',
    status: 'backend-backed',
    verification: {
      kind: 'manual',
      note: 'Needs an authenticated player-linked account to validate personalized data and gating.',
    },
    nextCloseoutStep: 'Use a Player test account to confirm linked identity, matchup entry, profile, messages, and upgrade states.',
  },
  {
    id: 'player-level-up',
    tierId: 'player_plus',
    label: 'Level Up Portal',
    route: '/player-development/[identity]/level-up',
    journeyStage: 'act',
    painPoint: 'Players leave lessons without an easy on-court way to choose a focus, train it, and log proof quickly.',
    job: 'Let players train, score proof, save a tiny note, and get the next useful rep.',
    status: 'local',
    verification: {
      kind: 'automated',
      script: 'scripts/verify-level-up-player-loop.mjs',
      note: 'Browser smoke validates the on-court loop with local persistence until linked backend sync is fully exercised.',
    },
    nextCloseoutStep: 'Run mobile visual QA and then validate linked player/coach sync with real accounts.',
  },
  {
    id: 'player-level-up-content',
    tierId: 'player_plus',
    label: 'Level Up Content Library',
    route: '/player-development/[identity]/level-up',
    journeyStage: 'plan',
    painPoint: 'Training libraries can become generic, making it hard for players to know which drill actually helps their game.',
    job: 'Keep drills, modules, recommendations, proof anchors, and identity lanes practical and tennis-specific.',
    status: 'backend-backed',
    verification: {
      kind: 'automated',
      script: 'scripts/verify-level-up-content.mjs',
      note: 'Deterministic test validates card quality, module links, lane coverage, and identity recommendations.',
    },
    nextCloseoutStep: 'Continue adding lane depth while keeping each new card scoreable and connected to tennis transfer.',
  },
  {
    id: 'coach-hub',
    tierId: 'coach',
    label: 'Coach Hub',
    route: '/coach',
    journeyStage: 'review',
    painPoint: 'Coaches need one place to see students, assigned work, proof, and the next lesson focus between sessions.',
    job: 'Help coaches manage students, assignments, sessions, and next lesson focus.',
    status: 'backend-backed',
    verification: {
      kind: 'automated',
      script: 'scripts/verify-coach-player-loop.mjs',
      note: 'Storage and contract tests validate coach/student/assignment/session payloads.',
    },
    nextCloseoutStep: 'Run browser QA with a coach account and confirm invite, assignment, review, and student detail states.',
  },
  {
    id: 'coach-invite-link',
    tierId: 'coach',
    label: 'Coach Invite Link',
    route: '/coach/invite/[token]',
    journeyStage: 'unlock',
    painPoint: 'Coach-player alignment breaks when the player is not linked to the coach inside the platform.',
    job: 'Let an invited player create or link an account to a coach relationship.',
    status: 'backend-backed',
    verification: {
      kind: 'needs-account',
      note: 'Needs a live coach/player test account pair to confirm token redemption and linked state.',
    },
    nextCloseoutStep: 'Create a disposable invite and walk through player signup, linked status, and Level Up visibility.',
  },
  {
    id: 'coach-lesson-planner',
    tierId: 'coach',
    label: 'Coach Lesson Planner',
    route: '/player-development/[identity]/coach-planner',
    journeyStage: 'plan',
    painPoint: 'Lesson plans can drift away from the player identity, assigned work, and readiness signals.',
    job: 'Give coaches one-hour lesson plans that support the player identity and current readiness.',
    status: 'manual',
    verification: {
      kind: 'manual',
      note: 'Needs print/digital review for lesson quality, coach-only copy, and identity fit.',
    },
    nextCloseoutStep: 'Review three identities and confirm coach planner supports Level Up assignments without leaking into player mode.',
  },
  {
    id: 'captain-lineup-week',
    tierId: 'captain',
    label: 'Captain Lineup Week',
    route: '/captain',
    journeyStage: 'plan',
    painPoint: 'Captains make weekly lineup decisions with scattered availability, readiness, scouting, and communication.',
    job: 'Move from availability and scouting to lineup decisions and team communication.',
    status: 'local',
    verification: {
      kind: 'manual',
      note: 'Captain tools need a scenario pass across availability, lineup builder, projection, and messaging.',
    },
    nextCloseoutStep: 'Run a captain-week fixture: set availability, build lineup, review projection, and create team brief.',
  },
  {
    id: 'captain-compete-bridge',
    tierId: 'captain',
    label: 'Compete Bridge',
    route: '/compete',
    journeyStage: 'discover',
    painPoint: 'Team context, schedules, and results can feel disconnected from the captain actions they should inform.',
    job: 'Connect team context, schedules, results, and captain tools without tier confusion.',
    status: 'manual',
    verification: {
      kind: 'manual',
      note: 'Needs route and copy pass from public compete surfaces into captain actions.',
    },
    nextCloseoutStep: 'Check compete teams, schedule, and results for clear captain upgrade or workspace handoff.',
  },
  {
    id: 'league-office',
    tierId: 'league',
    label: 'League Office',
    route: '/league-coordinator',
    journeyStage: 'operate',
    painPoint: 'Coordinators often run structure, schedules, results, standings, and visibility across too many manual tools.',
    job: 'Let coordinators manage league structure, team results, individual results, and tournaments.',
    status: 'backend-backed',
    verification: {
      kind: 'manual',
      note: 'Needs coordinator account and seeded league workspace to validate persistence and permissions.',
    },
    nextCloseoutStep: 'Run a coordinator fixture through schedule visibility, result entry, standings context, and public league page.',
  },
  {
    id: 'league-public-context',
    tierId: 'league',
    label: 'Public League Context',
    route: '/leagues/[league]',
    journeyStage: 'share',
    painPoint: 'Members need a clear public or member-facing place to see league schedule, result, and standings context.',
    job: 'Show members schedule, result, and standing context where public visibility is intended.',
    status: 'backend-backed',
    verification: {
      kind: 'automated',
      script: 'scripts/verify-platform-routes.mjs',
      note: 'Route smoke covers public league route availability; data quality still needs a seeded league pass.',
    },
    nextCloseoutStep: 'Spot-check public league pages with real fixture data and ensure coordinator updates show where intended.',
  },
  {
    id: 'full-court-navigation',
    tierId: 'full_court',
    label: 'Full-Court Navigation',
    route: '/pricing',
    journeyStage: 'unlock',
    painPoint: 'Multi-role users need all workspaces without repeated locks, duplicated prompts, or unclear role switching.',
    job: 'Show that Full-Court unlocks Player, Coach, Captain, and League workspaces without redundant upgrade prompts.',
    status: 'manual',
    verification: {
      kind: 'manual',
      note: 'Needs a full-access account to validate all workspace gates and navigation behavior.',
    },
    nextCloseoutStep: 'Use a Full-Court test account to visit Player, Coach, Captain, and League surfaces and confirm no stale locks.',
  },
  {
    id: 'admin-access-management',
    tierId: 'admin_internal',
    label: 'Admin Access Management',
    route: '/admin/access',
    journeyStage: 'admin',
    painPoint: 'Internal users need to activate and repair access without creating tier drift or billing confusion.',
    job: 'Let internal users activate, review, and repair access safely.',
    status: 'backend-backed',
    verification: {
      kind: 'manual',
      note: 'Admin workflows require protected credentials and careful fixture data.',
    },
    nextCloseoutStep: 'Run admin upgrade activation with a test account and confirm access-model changes propagate to gated pages.',
  },
  {
    id: 'admin-data-quality',
    tierId: 'admin_internal',
    label: 'Admin Data Quality',
    route: '/admin/import-queue',
    journeyStage: 'admin',
    painPoint: 'Imported tennis data needs review before it changes match history, rankings, player context, or league intelligence.',
    job: 'Review imported tennis data before it changes product intelligence.',
    status: 'manual',
    verification: {
      kind: 'manual',
      note: 'Needs import fixture coverage across queue, anomalies, dedupe, and missing scorecard workflows.',
    },
    nextCloseoutStep: 'Run one scorecard import through review, anomaly handling, and final match/player context.',
  },
]

export function getPlatformCloseoutFeaturesForTier(tierId: PlatformCloseoutTierId) {
  return PLATFORM_CLOSEOUT_FEATURES.filter((feature) => feature.tierId === tierId)
}

export function getPlatformCloseoutFeaturesByStatus(status: PlatformCapabilityStatus) {
  return PLATFORM_CLOSEOUT_FEATURES.filter((feature) => feature.status === status)
}

export function getPlatformCloseoutFeaturesByVerification(kind: PlatformVerificationKind) {
  return PLATFORM_CLOSEOUT_FEATURES.filter((feature) => feature.verification.kind === kind)
}

export function getPlatformCloseoutFeaturesByJourneyStage(stage: PlatformCustomerJourneyStage) {
  return PLATFORM_CLOSEOUT_FEATURES.filter((feature) => feature.journeyStage === stage)
}

export function getPlatformCloseoutOutstandingFeatures() {
  return PLATFORM_CLOSEOUT_FEATURES.filter((feature) => feature.verification.kind !== 'automated' || feature.status !== 'backend-backed')
}

export function getPlatformCloseoutNextActions(limit = 8) {
  return getPlatformCloseoutOutstandingFeatures()
    .sort((a, b) => closeoutPriorityScore(b) - closeoutPriorityScore(a))
    .slice(0, limit)
}

export function getPlatformCloseoutSummary() {
  return {
    totalFeatures: PLATFORM_CLOSEOUT_FEATURES.length,
    byTier: countBy(PLATFORM_CLOSEOUT_FEATURES, (feature) => feature.tierId),
    byStatus: countBy(PLATFORM_CLOSEOUT_FEATURES, (feature) => feature.status),
    byVerification: countBy(PLATFORM_CLOSEOUT_FEATURES, (feature) => feature.verification.kind),
    byJourneyStage: countBy(PLATFORM_CLOSEOUT_FEATURES, (feature) => feature.journeyStage),
    automatedFeatures: getPlatformCloseoutFeaturesByVerification('automated').length,
    outstandingFeatures: getPlatformCloseoutOutstandingFeatures().length,
    nextActions: getPlatformCloseoutNextActions(),
  }
}

function closeoutPriorityScore(feature: PlatformCloseoutFeature) {
  const tierPriority: Record<PlatformCloseoutTierId, number> = {
    coach: 7,
    player_plus: 6,
    captain: 5,
    league: 4,
    full_court: 3,
    admin_internal: 2,
    free: 1,
  }
  const verificationPriority: Record<PlatformVerificationKind, number> = {
    'needs-account': 8,
    manual: 5,
    blocked: 4,
    automated: 1,
  }
  const statusPriority: Record<PlatformCapabilityStatus, number> = {
    blocked: 8,
    mock: 7,
    local: 12,
    manual: 5,
    'backend-backed': 1,
  }

  return tierPriority[feature.tierId] + verificationPriority[feature.verification.kind] + statusPriority[feature.status]
}

function countBy<TItem, TKey extends string>(items: TItem[], getKey: (item: TItem) => TKey) {
  return items.reduce<Record<TKey, number>>((counts, item) => {
    const key = getKey(item)
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {} as Record<TKey, number>)
}
