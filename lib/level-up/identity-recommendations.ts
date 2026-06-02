export type IdentityLevelUpProfile = {
  identitySlug: string
  featuredModuleIds: string[]
  starterCardIds: string[]
  focusTags: string[]
  lanePriority?: string[]
  avoidTags?: string[]
  recommendationCopy: string
}

export const IDENTITY_LEVEL_UP_PROFILES: Record<string, IdentityLevelUpProfile> = {
  'relentless-competitor-4-0': {
    identitySlug: 'relentless-competitor-4-0',
    featuredModuleIds: [
      'recovery-after-contact',
      'light-feet-starter',
      'late-match-legs',
      'serve-pressure-routine',
      'return-intent',
      'wide-ball-reset',
      'pressure-reset',
    ],
    starterCardIds: [
      'cone-recover-shadow-swing',
      'jump-rope-rhythm-builder',
      'wall-sit-leg-durability',
      'serve-target-call',
      'return-shadow-split-read',
      'three-step-reset',
      'wide-ball-neutralizer',
      'post-play-mobility-reset',
    ],
    focusTags: [
      'recovery-after-contact',
      'light-feet',
      'serve-routine',
      'return-intent',
      'return-recovery',
      'leg-durability',
      'pressure-reset',
      'defense-to-neutral',
      'decision-quality',
    ],
    lanePriority: ['movement', 'return', 'serve', 'singles', 'fitness', 'pressure', 'backhand', 'doubles'],
    recommendationCopy:
      'Recommended for Relentless Competitor because this path builds recovery, serve and return routine, late-game legs, and pressure response.',
  },
  'smart-attacker-4-0-to-4-5': {
    identitySlug: 'smart-attacker-4-0-to-4-5',
    featuredModuleIds: [
      'serve-plus-one-clarity',
      'forward-close',
      'attack-balance',
      'return-intent',
      'crosscourt-build-before-change',
      'shoulder-core-serve-support',
    ],
    starterCardIds: [
      'serve-1-shadow',
      'cone-close-recover',
      'short-ball-close-split',
      'single-leg-rdl',
      'return-step-in-game',
      'return-depth-lane',
      'towel-serve-flow',
    ],
    focusTags: [
      'serve-plus-one',
      'forward-close',
      'attack-balance',
      'return-intent',
      'return-recovery',
      'crosscourt-build',
      'decision-quality',
    ],
    lanePriority: ['serve', 'forehand', 'volley', 'return', 'singles', 'movement', 'fitness', 'doubles'],
    recommendationCopy:
      'Recommended for Smart Attacker because this path builds serve +1 clarity, forward closing, return intent, and balanced first-strike decisions.',
  },
  'consistent-builder-4-0': {
    identitySlug: 'consistent-builder-4-0',
    featuredModuleIds: [
      'crosscourt-build-before-change',
      'recovery-after-contact',
      'wide-ball-reset',
      'match-day-warm-up',
      'pressure-reset',
      'post-play-mobility-reset',
      'wall-work-starter',
    ],
    starterCardIds: [
      'crosscourt-consistency',
      'basket-forehand-crosscourt',
      'basket-backhand-crosscourt',
      'wide-ball-neutralizer',
      'wall-depth-builder',
      'three-step-reset',
      'dynamic-tennis-warm-up',
      'post-play-mobility-reset',
    ],
    focusTags: [
      'crosscourt-build',
      'recovery-after-contact',
      'wide-ball-reset',
      'defense-to-neutral',
      'pressure-reset',
      'match-day',
      'wall-work',
      'decision-quality',
    ],
    lanePriority: ['forehand', 'backhand', 'movement', 'singles', 'return', 'serve', 'fitness', 'doubles'],
    recommendationCopy:
      'Recommended for Consistent Builder because this path builds crosscourt tolerance, recovery, wide-ball reset, match-day readiness, and pressure control.',
  },
  default: {
    identitySlug: 'default',
    featuredModuleIds: [
      'match-day-warm-up',
      'at-home-starter-pack',
      'pressure-reset',
      'post-play-mobility-reset',
    ],
    starterCardIds: [
      'dynamic-tennis-warm-up',
      'three-step-reset',
      'post-play-mobility-reset',
    ],
    focusTags: ['warm-up', 'pressure-reset', 'mobility', 'at-home'],
    lanePriority: ['match', 'movement', 'serve', 'return', 'singles', 'fitness'],
    recommendationCopy:
      'Recommended because these cards are safe starter tools for building a repeatable tennis habit.',
  },
}
