export type IdentityLevelUpProfile = {
  identitySlug: string
  featuredModuleIds: string[]
  starterCardIds: string[]
  focusTags: string[]
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
    recommendationCopy:
      'Recommended for Smart Attacker because this path builds serve +1 clarity, forward closing, return intent, and balanced first-strike decisions.',
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
    recommendationCopy:
      'Recommended because these cards are safe starter tools for building a repeatable tennis habit.',
  },
}
