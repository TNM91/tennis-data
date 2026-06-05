import type { MembershipTierId } from './product-story'

export type PlatformCloseoutTierId = MembershipTierId | 'admin_internal'

export type PlatformCapabilityStatus = 'backend-backed' | 'local' | 'mock' | 'manual' | 'blocked'

export type PlatformVerificationKind = 'automated' | 'manual' | 'needs-account' | 'blocked'

export type PlatformCloseoutFeature = {
  id: string
  tierId: PlatformCloseoutTierId
  label: string
  route: string
  job: string
  status: PlatformCapabilityStatus
  verification: {
    kind: PlatformVerificationKind
    script?: string
    note: string
  }
  nextCloseoutStep: string
}

export const PLATFORM_CLOSEOUT_FEATURES: PlatformCloseoutFeature[] = [
  {
    id: 'free-public-explore',
    tierId: 'free',
    label: 'Public Explore',
    route: '/explore',
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
