export type LevelUpCategory =
  | 'court-drill'
  | 'solo-drill'
  | 'partner-drill'
  | 'doubles-drill'
  | 'serve-return'
  | 'movement-engine'
  | 'strength-stability'
  | 'conditioning'
  | 'mobility-stretch'
  | 'recovery-reset'
  | 'mental-routine'
  | 'match-prep'

export type LevelUpSetting =
  | 'home'
  | 'driveway'
  | 'garage'
  | 'court'
  | 'wall'
  | 'gym'
  | 'match-day'

export type LevelUpEquipment =
  | 'none'
  | 'cones'
  | 'jump-rope'
  | 'resistance-band'
  | 'wall'
  | 'basket'
  | 'partner'
  | 'medicine-ball'
  | 'chair'
  | 'towel'

export type LevelUpLevel =
  | 'starter'
  | 'builder'
  | 'competitor'
  | 'advanced'

export type LevelUpIntensity =
  | 'low'
  | 'medium'
  | 'high'

export type LevelUpCard = {
  id: string
  title: string
  category: LevelUpCategory
  pack: string
  level: LevelUpLevel
  setting: LevelUpSetting[]
  equipment: LevelUpEquipment[]
  durationMinutes: number
  intensity: LevelUpIntensity
  assignable: boolean
  favoriteable: boolean
  useWhen: string
  tennisGoal: string
  cue: string
  routine: string[]
  reward: string
  proof: string
  ratingLabels?: string[]
  qualityChecks?: string[]
  commonMiss?: {
    miss: string
    fix: string
  }
  proofAnchors?: {
    low: string
    mid: string
    high: string
  }
  progression?: string
  regression?: string
  safetyNote?: string
  tags: string[]
  identitySlugs?: string[]
}

export type LevelUpModule = {
  id: string
  title: string
  subtitle: string
  description: string
  useWhen?: string
  sessionPlan?: string[]
  successCriteria?: string
  level: LevelUpLevel
  durationLabel: string
  cardIds: string[]
  tags: string[]
  identitySlugs?: string[]
  proof: string
}

export type LevelUpAssignment = {
  id: string
  playerId: string
  coachId?: string
  cardId?: string
  moduleId?: string
  assignedAt: string
  dueAt?: string
  coachNote?: string
  proofRequired?: string
  status: 'assigned' | 'started' | 'completed' | 'skipped'
}

export type LevelUpFavorite = {
  playerId: string
  cardId?: string
  moduleId?: string
  createdAt: string
}

export type LevelUpCompletion = {
  id: string
  playerId: string
  cardId: string
  completedAt: string
  proofRating?: number
  note?: string
  durationMinutes?: number
  assignmentId?: string
}

export type LevelUpRecommendation = {
  cardId?: string
  moduleId?: string
  score: number
  reason: string
  source: 'identity' | 'coach' | 'goal' | 'recent-leak' | 'quick-win' | 'favorite-history'
}

export type LevelUpHabitCategory =
  | 'tennis-skill'
  | 'fitness'
  | 'nutrition-hydration'
  | 'mindset'
  | 'recovery'
  | 'match-prep'

export type LevelUpQuestCadence = 'daily' | 'weekly' | 'practice-day' | 'match-day'

export type LevelUpQuestTemplate = {
  id: string
  title: string
  category: LevelUpHabitCategory
  cadence: LevelUpQuestCadence
  xp: number
  level: LevelUpLevel
  description: string
  proof: string
  linkedCardIds: string[]
  starterHabit: string
}

export type LevelUpCustomQuest = {
  id: string
  userId: string
  title: string
  category: LevelUpHabitCategory
  cadence: LevelUpQuestCadence
  xp: number
  linkedCardId: string | null
  proof: string
  starterHabit: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type LevelUpCustomQuestCompletion = {
  id: string
  userId: string
  customQuestId: string
  levelUpSessionId: string | null
  identitySlug: string
  cardId: string | null
  completedOn: string
  completedAt: string
  xp: number
  proofRating: number | null
  note: string
  createdAt: string
  updatedAt: string
}

export type LevelUpQuestBuilderPlan = {
  templates: Array<LevelUpQuestTemplate & {
    primaryCard: LevelUpCard
    drillHref: string
  }>
  categories: LevelUpHabitCategory[]
}

export type LevelUpHabitPath = {
  id: string
  label: string
  title: string
  category: LevelUpHabitCategory
  cadence: LevelUpQuestCadence
  xp: number
  playerLevel: string
  weeklyTarget: string
  bestFor: string
  coachPackId: string
  teamChallengeId: string
  linkedCardIds: string[]
  habits: string[]
  proof: string
}
