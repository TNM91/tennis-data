import { IDENTITY_LEVEL_UP_PROFILES } from './identity-recommendations'
import { LEVEL_UP_CARDS } from './level-up-cards'
import { LEVEL_UP_MODULES } from './level-up-modules'
import type { LevelUpCard, LevelUpRecommendation } from './level-up-types'

type ScoreLevelUpCardArgs = {
  card: LevelUpCard
  identitySlug: string
  activeGoalTags?: string[]
  availableEquipment?: string[]
  preferredSetting?: string
  timeAvailable?: number
  completedCardIds?: string[]
  favoriteCardIds?: string[]
}

export type RecommendLevelUpCardsArgs = Omit<ScoreLevelUpCardArgs, 'card'> & {
  limit?: number
}

export function getLevelUpProfileForIdentity(identitySlug: string) {
  return IDENTITY_LEVEL_UP_PROFILES[identitySlug] ?? IDENTITY_LEVEL_UP_PROFILES.default
}

export function getRecommendedModulesForIdentity(identitySlug: string) {
  const profile = getLevelUpProfileForIdentity(identitySlug)
  const ids = new Set(profile.featuredModuleIds)
  const ranked = LEVEL_UP_MODULES.filter((module) => ids.has(module.id))
  return ranked.length ? ranked : LEVEL_UP_MODULES.filter((module) => IDENTITY_LEVEL_UP_PROFILES.default.featuredModuleIds.includes(module.id))
}

export function getRecommendedCardsForIdentity(identitySlug: string) {
  const profile = getLevelUpProfileForIdentity(identitySlug)
  const ids = new Set(profile.starterCardIds)
  const ranked = LEVEL_UP_CARDS.filter((card) => ids.has(card.id))
  return ranked.length ? ranked : LEVEL_UP_CARDS.filter((card) => IDENTITY_LEVEL_UP_PROFILES.default.starterCardIds.includes(card.id))
}

export function scoreLevelUpCard({
  card,
  identitySlug,
  activeGoalTags = [],
  availableEquipment = [],
  preferredSetting,
  timeAvailable,
  completedCardIds = [],
  favoriteCardIds = [],
}: ScoreLevelUpCardArgs): LevelUpRecommendation {
  const profile = getLevelUpProfileForIdentity(identitySlug)
  const reasons: string[] = []
  let score = 0

  if (card.identitySlugs?.includes(identitySlug)) {
    score += 50
    reasons.push('Recommended for your Player Identity.')
  }

  const focusTag = firstOverlap(card.tags, profile.focusTags)
  if (focusTag) {
    score += 30
    reasons.push(`Matches your identity focus: ${formatTag(focusTag)}.`)
  }

  const goalTag = firstOverlap(card.tags, activeGoalTags)
  if (goalTag) {
    score += 25
    reasons.push(`Matches your current goal: ${formatTag(goalTag)}.`)
  }

  if (typeof timeAvailable === 'number' && card.durationMinutes <= timeAvailable) {
    score += 15
    reasons.push(`Quick win under ${timeAvailable} minutes.`)
  }

  const equipment = firstOverlap(card.equipment, availableEquipment)
  if (equipment) {
    score += 10
    reasons.push(`Uses equipment you selected: ${formatTag(equipment)}.`)
  }

  if (preferredSetting && card.setting.some((setting) => setting === preferredSetting)) {
    score += 10
    reasons.push(`Fits your setting: ${formatTag(preferredSetting)}.`)
  }

  if (favoriteCardIds.includes(card.id)) {
    score += 5
    reasons.push('Already in your favorites.')
  }

  if (completedCardIds.includes(card.id)) {
    score -= 8
    reasons.push('Recently completed, so rotate only if you want a repeat.')
  }

  if (profile.starterCardIds.includes(card.id)) {
    score += 20
    reasons.push('Starter card for this identity.')
  }

  return {
    cardId: card.id,
    score,
    reason: reasons[0] ?? 'Recommended as a useful Level Up card.',
    source: card.identitySlugs?.includes(identitySlug) ? 'identity' : activeGoalTags.length ? 'goal' : 'quick-win',
  }
}

export function recommendLevelUpCards(args: RecommendLevelUpCardsArgs) {
  return LEVEL_UP_CARDS
    .map((card) => scoreLevelUpCard({ ...args, card }))
    .sort((a, b) => b.score - a.score)
    .slice(0, args.limit ?? 12)
}

function firstOverlap(items: string[], candidates: string[]) {
  return items.find((item) => candidates.includes(item))
}

function formatTag(value: string) {
  return value.replaceAll('-', ' ')
}
