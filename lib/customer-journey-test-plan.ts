import type { PlatformCloseoutTierId } from './platform-closeout-inventory'
import { PLATFORM_CLOSEOUT_FEATURES } from './platform-closeout-inventory'

export type CustomerJourneyRisk = 'critical' | 'high' | 'medium'

export type CustomerJourneyFixtureId =
  | 'free_viewer'
  | 'player_plus_linked'
  | 'coach_primary'
  | 'captain_primary'
  | 'league_coordinator'
  | 'full_court_operator'
  | 'admin_test'
  | 'linked-player-profile'
  | 'coach-invite-token'
  | 'level-up-assignment'
  | 'level-up-completion'
  | 'captain-team-week'
  | 'league-week'
  | 'data-assist-upload'
  | 'full-court-access-state'
  | 'admin-access-repair'

export type CustomerJourneyTestPlan = {
  id: string
  label: string
  tierId: PlatformCloseoutTierId
  suggestedOrder: number
  risk: CustomerJourneyRisk
  personaFixture: CustomerJourneyFixtureId
  featureIds: string[]
  fixtureIds: CustomerJourneyFixtureId[]
  entryRoute: string
  primaryQuestion: string
  successSignal: string
  failFastSignals: string[]
  evidenceToCapture: string[]
}

const FEATURE_IDS = new Set(PLATFORM_CLOSEOUT_FEATURES.map((feature) => feature.id))

export const CUSTOMER_JOURNEY_TEST_PLANS: CustomerJourneyTestPlan[] = [
  {
    id: 'player-level-up-mobile-loop',
    label: 'Player Level Up mobile loop',
    tierId: 'player_plus',
    suggestedOrder: 1,
    risk: 'critical',
    personaFixture: 'player_plus_linked',
    featureIds: ['player-level-up', 'player-level-up-content'],
    fixtureIds: ['player_plus_linked', 'level-up-completion'],
    entryRoute: '/player-development/relentless-competitor-4-0/level-up',
    primaryQuestion: 'Can a player start useful tennis work on a phone, score proof, and know the next rep without extra scrolling?',
    successSignal: 'Active training becomes the main screen, proof saves honestly, and the next action is obvious.',
    failFastSignals: ['too much scroll before action', 'local proof presented as synced', 'generic drill copy', 'missing next action'],
    evidenceToCapture: [
      'phone screenshot of active card',
      'saved proof status text',
      'Level Up local sync proof cue',
      'next recommendation',
      'My Lab Level Up return-state panel',
      'tiny note behavior',
    ],
  },
  {
    id: 'coach-player-assigned-challenge',
    label: 'Coach to player assigned challenge',
    tierId: 'coach',
    suggestedOrder: 2,
    risk: 'critical',
    personaFixture: 'coach_primary',
    featureIds: ['coach-hub', 'coach-invite-link', 'player-level-up'],
    fixtureIds: ['coach_primary', 'player_plus_linked', 'coach-invite-token', 'level-up-assignment', 'level-up-completion'],
    entryRoute: '/coach',
    primaryQuestion: 'Can a coach assign one useful tool and see the player proof come back through the linked relationship?',
    successSignal: 'Invite, assignment, player challenge, proof, and coach review close the loop without manual cleanup.',
    failFastSignals: ['assignment visible to wrong player', 'proof only local when UI says synced', 'coach cannot find proof', 'no next lesson handoff'],
    evidenceToCapture: [
      'invite link state',
      'Linking proof privacy cue',
      'Invite acceptance proof cue',
      'Coach invite account proof cue',
      'assignment id',
      'player challenge screen',
      'coach review proof sync cue',
      'proof rating and note',
    ],
  },
  {
    id: 'coach-lesson-support',
    label: 'Coach lesson support',
    tierId: 'coach',
    suggestedOrder: 3,
    risk: 'high',
    personaFixture: 'coach_primary',
    featureIds: ['coach-lesson-planner', 'player-level-up-content'],
    fixtureIds: ['coach_primary', 'linked-player-profile', 'level-up-assignment'],
    entryRoute: '/player-development/relentless-competitor-4-0/coach-planner',
    primaryQuestion: 'Can the coach turn identity, readiness, and assigned work into a useful one-hour lesson plan?',
    successSignal: 'The planner is coach-facing, practical, and connected to the player Level Up path.',
    failFastSignals: ['player-facing workbook copy', 'lesson plan feels disconnected from Level Up', 'no assignment handoff'],
    evidenceToCapture: [
      'planner identity',
      'warm-up block',
      'skill block',
      'pressure block',
      'Coach lesson support proof cue',
      'Level Up assignment handoff cue',
      'assignment handoff',
    ],
  },
  {
    id: 'player-my-lab-return-state',
    label: 'Player My Lab return state',
    tierId: 'player_plus',
    suggestedOrder: 4,
    risk: 'high',
    personaFixture: 'player_plus_linked',
    featureIds: ['player-my-lab'],
    fixtureIds: ['player_plus_linked', 'linked-player-profile'],
    entryRoute: '/mylab',
    primaryQuestion: 'Can a player come back later and understand their personal tennis context and next useful action?',
    successSignal: 'My Lab makes the player identity, linked profile, Level Up return state, and next action clear after refresh.',
    failFastSignals: ['generic empty dashboard', 'linked player unclear', 'Level Up proof missing after refresh', 'stale upgrade lock'],
    evidenceToCapture: [
      'linked profile state',
      'identity signal',
      'next action',
      'Level Up return-state panel after refresh',
      'My Lab refresh proof cue',
    ],
  },
  {
    id: 'captain-week-flow',
    label: 'Captain week flow',
    tierId: 'captain',
    suggestedOrder: 5,
    risk: 'high',
    personaFixture: 'captain_primary',
    featureIds: ['captain-lineup-week', 'captain-compete-bridge'],
    fixtureIds: ['captain_primary', 'captain-team-week'],
    entryRoute: '/captain',
    primaryQuestion: 'Can a captain move from availability and scouting to lineup choice and team communication?',
    successSignal: 'Captain can make a weekly decision and produce a useful team-facing update.',
    failFastSignals: [
      'availability disconnected from lineup',
      'projection unclear',
      'message/brief dead end',
      'Captain save status implies account sync',
      'Captain tier copy missing',
    ],
    evidenceToCapture: [
      'availability state',
      'lineup option',
      'projection/scenario result',
      'save status local honesty cue',
      'Captain local sync proof cue',
      'Captain decision handoff proof cue',
      'Compete Bridge captain handoff cue',
      'team brief or message',
    ],
  },
  {
    id: 'league-result-to-public-context',
    label: 'League result to public context',
    tierId: 'league',
    suggestedOrder: 6,
    risk: 'high',
    personaFixture: 'league_coordinator',
    featureIds: ['league-office', 'league-public-context'],
    fixtureIds: ['league_coordinator', 'league-week'],
    entryRoute: '/league-coordinator',
    primaryQuestion: 'Can a coordinator record or review league results and see the intended public/member context update?',
    successSignal: 'Coordinator operation and member-facing league context stay connected without exposing private controls.',
    failFastSignals: ['result does not propagate', 'private controls visible publicly', 'standings context missing', 'fixture data unsafe'],
    evidenceToCapture: [
      'result fixture',
      'coordinator source screen',
      'League Office operation proof cue',
      'source-to-public proof cue',
      'public league screen',
      'privacy check',
    ],
  },
  {
    id: 'full-court-access-pass',
    label: 'Full-Court access pass',
    tierId: 'full_court',
    suggestedOrder: 7,
    risk: 'medium',
    personaFixture: 'full_court_operator',
    featureIds: ['full-court-navigation'],
    fixtureIds: ['full_court_operator', 'full-court-access-state'],
    entryRoute: '/pricing',
    primaryQuestion: 'Can a multi-role user move through Player, Coach, Captain, and League surfaces without stale locks?',
    successSignal: 'All paid tools open cleanly and the user can tell which tool fits the need.',
    failFastSignals: ['paid tool locked', 'redundant upgrade prompt', 'role navigation confusing'],
    evidenceToCapture: [
      'pricing tier copy',
      'Full-Court access pass cue',
      'Full-Court tool fit proof cue',
      'Full-Court role switching proof cue',
      'Player workspace',
      'Coach workspace',
      'Captain workspace',
      'League workspace',
    ],
  },
  {
    id: 'admin-access-and-data-quality',
    label: 'Admin access and data quality',
    tierId: 'admin_internal',
    suggestedOrder: 8,
    risk: 'high',
    personaFixture: 'admin_test',
    featureIds: ['admin-access-management', 'admin-data-quality', 'free-data-assist-entry'],
    fixtureIds: ['admin_test', 'admin-access-repair', 'data-assist-upload'],
    entryRoute: '/admin/access',
    primaryQuestion: 'Can internal users repair access and protect imported tennis data without changing real customer data?',
    successSignal: 'Access/data repair is understandable, fixture-safe, and reflected in affected product surfaces.',
    failFastSignals: ['test data not isolated', 'access change not reflected', 'unreviewed data treated as trusted', 'no rollback note'],
    evidenceToCapture: [
      'test profile',
      'starting access',
      'target access',
      'fixture safety rollback cue',
      'Admin access repair proof cue',
      'import review status',
      'data trust guard cue',
      'Admin import outcome proof cue',
      'affected surface',
    ],
  },
  {
    id: 'free-public-discovery',
    label: 'Free public discovery',
    tierId: 'free',
    suggestedOrder: 9,
    risk: 'medium',
    personaFixture: 'free_viewer',
    featureIds: ['free-public-explore', 'free-data-assist-entry'],
    fixtureIds: ['free_viewer', 'data-assist-upload'],
    entryRoute: '/explore',
    primaryQuestion: 'Can a visitor find useful tennis context before being asked to upgrade?',
    successSignal: 'Public tennis intelligence is visible first, and upgrade/data-assist paths are clear.',
    failFastSignals: ['upgrade prompt appears before useful context', 'public detail unavailable', 'Data Assist implies instant trusted data'],
    evidenceToCapture: [
      'Explore route',
      'Public discovery proof cue',
      'public detail page',
      'pricing handoff',
      'Data Assist review-first handoff cue',
      'Data Assist upload state proof cue',
    ],
  },
]

export function getCustomerJourneyTestPlan(id: string) {
  return CUSTOMER_JOURNEY_TEST_PLANS.find((plan) => plan.id === id)
}

export function getCustomerJourneyTestPlansForTier(tierId: PlatformCloseoutTierId) {
  return CUSTOMER_JOURNEY_TEST_PLANS.filter((plan) => plan.tierId === tierId).sort((a, b) => a.suggestedOrder - b.suggestedOrder)
}

export function getHighestRiskCustomerJourneyPlans(limit = 5) {
  return [...CUSTOMER_JOURNEY_TEST_PLANS].sort((a, b) => riskScore(b) - riskScore(a)).slice(0, limit)
}

export function getCustomerJourneyFixtureIds() {
  return [...new Set(CUSTOMER_JOURNEY_TEST_PLANS.flatMap((plan) => plan.fixtureIds))]
}

export function hasKnownCloseoutFeature(featureId: string) {
  return FEATURE_IDS.has(featureId)
}

function riskScore(plan: CustomerJourneyTestPlan) {
  const riskValue: Record<CustomerJourneyRisk, number> = {
    critical: 100,
    high: 70,
    medium: 40,
  }

  return riskValue[plan.risk] - plan.suggestedOrder
}
