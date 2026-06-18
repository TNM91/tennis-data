import { MEMBERSHIP_TIERS } from '../product-story'

export type LevelUpSyncStatus = 'backend-backed' | 'hybrid' | 'local-only' | 'manual-copy'

const PLAYER_TIER_NAME = MEMBERSHIP_TIERS.player_plus.name

export type LevelUpSyncContract = {
  id: string
  label: string
  status: LevelUpSyncStatus
  userStory: string
  sourceOfTruth: string
  backendTables: string[]
  apiRoutes: string[]
  localStorageKeys: string[]
  accessModes: string[]
  testSignal: string
  failFastIf: string
}

export const LEVEL_UP_SYNC_CONTRACTS: LevelUpSyncContract[] = [
  {
    id: 'coach-assignments',
    label: 'Coach assignments',
    status: 'backend-backed',
    userStory: 'Coach assigns one Level Up tool and the linked player sees it as a challenge.',
    sourceOfTruth: 'coach_assignments linked through coach_player_links',
    backendTables: ['coach_assignments', 'coach_player_links'],
    apiRoutes: ['/api/coach/assignments', '/api/player/coach-assignments'],
    localStorageKeys: ['tiq-level-up-local-coach-assignments:<identitySlug>'],
    accessModes: ['coach_invited'],
    testSignal: 'Coach-created assignment appears to the linked player and unlinked players cannot see it.',
    failFastIf: 'A player sees an assignment not tied to their coach_player_links row.',
  },
  {
    id: 'proof-history',
    label: 'Level Up proof history',
    status: 'hybrid',
    userStory: `Player completes proof once; linked coach or ${PLAYER_TIER_NAME} history can use it later.`,
    sourceOfTruth: `level_up_sessions when signed in with coach invite or ${PLAYER_TIER_NAME}; localStorage fallback otherwise`,
    backendTables: ['level_up_sessions'],
    apiRoutes: ['/api/player/level-up-sessions', '/api/coach/level-up-sessions'],
    localStorageKeys: ['tiq-level-up-completions', 'tenaceiq:level-up:<identitySlug>'],
    accessModes: ['coach_invited', 'player_plus', 'free_preview'],
    testSignal: `Coach-invited proof syncs to coach review; ${PLAYER_TIER_NAME} proof syncs to player history; Free preview remains local.`,
    failFastIf: 'UI says synced when the session only exists in localStorage.',
  },
  {
    id: 'favorites',
    label: 'Favorites',
    status: 'local-only',
    userStory: 'Player pins useful cards for quick repeat access on the same device.',
    sourceOfTruth: 'localStorage only in v1',
    backendTables: [],
    apiRoutes: [],
    localStorageKeys: ['tiq-level-up-favorites'],
    accessModes: ['coach_invited', 'player_plus', 'free_preview'],
    testSignal: 'Favorited cards persist after refresh on the same device.',
    failFastIf: 'Tester expects favorites to follow the player across devices before backend persistence exists.',
  },
  {
    id: 'coach-update-copy',
    label: 'Coach update copy status',
    status: 'manual-copy',
    userStory: 'Player copies a short coach update after proof so they can send it through the current communication path.',
    sourceOfTruth: 'manual copy text plus local sent markers',
    backendTables: [],
    apiRoutes: [],
    localStorageKeys: ['tiq-level-up-coach-sent', 'tiq-level-up-coach-sent-at'],
    accessModes: ['coach_invited', 'player_plus', 'free_preview'],
    testSignal: 'Copy/manual fallback works and sent markers survive refresh on the same device.',
    failFastIf: 'UI implies the update was automatically delivered to a coach when it was only copied or locally marked sent.',
  },
  {
    id: 'live-workbench-session',
    label: 'Live workbench session',
    status: 'hybrid',
    userStory: 'Player uses the compact live workbench, saves proof locally first, then syncs when access is connected.',
    sourceOfTruth: 'level_up_sessions when sync succeeds; tenaceiq:level-up:<identitySlug> local fallback otherwise',
    backendTables: ['level_up_sessions'],
    apiRoutes: ['/api/player/level-up-sessions'],
    localStorageKeys: ['tenaceiq:level-up:<identitySlug>', 'tiq-level-up-completions'],
    accessModes: ['coach_invited', 'player_plus', 'free_preview'],
    testSignal: 'Saved live workbench sessions show local-first status, then synced/local/error status based on access path.',
    failFastIf: 'Free preview work is presented as cloud history or coach-visible proof.',
  },
]

export function getLevelUpSyncContract(id: string) {
  return LEVEL_UP_SYNC_CONTRACTS.find((contract) => contract.id === id)
}

export function getLevelUpSyncContractsByStatus(status: LevelUpSyncStatus) {
  return LEVEL_UP_SYNC_CONTRACTS.filter((contract) => contract.status === status)
}
