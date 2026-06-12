export const PERSONAL_QUEST_OWNER_EMAILS = [
  'nmeinert91@gmail.com',
  ...splitAllowlist(process.env.NEXT_PUBLIC_LEVEL_UP_MY_QUEST_OWNER_EMAILS),
].map((email) => email.toLowerCase())

export const PERSONAL_QUEST_OWNER_IDS = [
  'accc3471-8912-491c-b8d9-4a84dcc7c42e',
  ...splitAllowlist(process.env.NEXT_PUBLIC_LEVEL_UP_MY_QUEST_OWNER_IDS),
]

export const PERSONAL_QUEST_PHOTO_BUCKET = 'personal-quest-photos'

export type PersonalQuestId =
  | 'protein_breakfast'
  | 'no_chips_lunch'
  | 'creamer_goal'
  | 'water_80_oz'
  | 'activity_20_min'
  | 'core_workout'
  | 'alcohol_limit'
  | 'no_food_after_8'

export type PersonalQuestDefinition = {
  id: PersonalQuestId
  title: string
  shortTitle: string
  xp: number
  bossKey?: WeeklyBossKey
}

export type WeeklyBossKey = 'ipa' | 'lunch' | 'creamer' | 'water'

export type PersonalQuestLevel = {
  title: string
  xp: number
}

export type DailyQuestCompletion = {
  quest_id: PersonalQuestId
  completed_on: string
  xp_awarded: number
}

export type DailyLog = {
  log_date: string
  ipa_count: number
  notes: string
}

export type PersonalStreakFreeze = {
  freeze_date: string
  reason: string
}

export type Measurement = {
  measured_on: string
  waist_inches: number | null
}

export type PersonalQuestProfile = {
  weekly_rule: string
}

export type WeeklyReview = {
  week_start: string
  waist_inches: number | null
  weekly_xp: number
  ipa_count: number
  chip_free_lunches: number
  biggest_win: string
  biggest_miss: string
  focus_next_week: string
}

export type ProgressPhoto = {
  id: string
  photo_type: ProgressPhotoType
  storage_path: string
  captured_on?: string
  created_at: string
}

export type ProgressPhotoType = 'front' | 'side' | 'flex'

export type AchievementDefinition = {
  id: string
  title: string
  target: number
  metric: AchievementMetric
}

export type AchievementMetric =
  | 'chipFreeLunches'
  | 'creamerDays'
  | 'ipaGoalWeeks'
  | 'waterDays'
  | 'activitySessions'
  | 'coreWorkouts'
  | 'streak'

export type PersonalQuestStats = {
  totalXp: number
  dailyXp: number
  weeklyXp: number
  weeklyQuestXp: number
  weeklyBossXp: number
  currentStreak: number
  level: PersonalQuestLevel
  nextLevel: PersonalQuestLevel | null
  xpIntoLevel: number
  xpForNextLevel: number
  levelProgress: number
  nextMilestone: string
  achievements: Array<AchievementDefinition & { progress: number; unlocked: boolean }>
  bosses: WeeklyBossProgress[]
}

export type PersonalQuestHeatmapDay = {
  date: string
  completedCount: number
  totalCount: number
  xp: number
  intensity: 0 | 1 | 2 | 3 | 4
  isToday: boolean
}

export type PersonalQuestMode = 'morning' | 'evening' | 'recovery'

export type SmartQuestRecommendation = {
  quest: PersonalQuestDefinition | null
  reason: string
  cta: string
}

export type PersonalQuestTrendCard = {
  label: string
  value: string
  detail: string
  tone: 'green' | 'blue' | 'amber'
}

export type PersonalQuestBossForecast = {
  key: WeeklyBossKey
  title: string
  status: 'on-track' | 'needs-action' | 'at-risk' | 'complete'
  headline: string
  detail: string
  progress: number
}

export type PersonalQuestCombo = {
  id: string
  title: string
  detail: string
  completed: boolean
  progress: number
}

export type PersonalQuestGamePlan = {
  winCondition: string
  doNotMiss: string
  lowestEffortXp: string
  bossDanger: string
}

export type PersonalQuestLoadout = {
  id: string
  title: string
  detail: string
  questIds: PersonalQuestId[]
  progress: number
  completed: boolean
  recommended: boolean
}

export type PersonalQuestSeasonNode = PersonalQuestLevel & {
  status: 'cleared' | 'current' | 'locked'
  progress: number
}

export type PersonalQuestBossStrategy = {
  title: string
  headline: string
  action: string
  tone: 'green' | 'amber' | 'red'
}

export type PersonalQuestFreezeStatus = {
  usedThisMonth: number
  remainingThisMonth: number
  canUseToday: boolean
  protectedToday: boolean
  targetDate: string
  detail: string
}

export type PersonalQuestDailyRecap = {
  title: string
  xp: number
  completedCount: number
  totalCount: number
  streakStatus: string
  bossMisses: string[]
  tomorrow: string
}

export type PersonalQuestMomentum = {
  score: number
  label: string
  detail: string
  trend: 'up' | 'steady' | 'down'
  days: Array<{
    date: string
    score: number
    label: string
  }>
}

export type PersonalQuestBossCalendarItem = {
  key: WeeklyBossKey
  title: string
  headline: string
  detail: string
  progress: number
  tone: 'green' | 'amber' | 'red'
}

export type PersonalQuestReminder = {
  id: string
  title: string
  time: string
  detail: string
  active: boolean
}

export type PersonalQuestWaistTrend = {
  latest: number | null
  delta: number | null
  label: string
  points: Array<{
    date: string
    value: number
    progress: number
  }>
}

export type PersonalQuestAchievementDetail = AchievementDefinition & {
  progress: number
  unlocked: boolean
  remaining: number
  fastestPath: string
}

export type PersonalQuestFinale = {
  unlocked: boolean
  progress: number
  title: string
  detail: string
  challenge: string
  badge: string
}

export type PersonalQuestRepairSummary = {
  date: string
  completedCount: number
  totalCount: number
  xp: number
  ipaCount: number
  status: 'empty' | 'partial' | 'complete'
}

export type PersonalQuestFocusSuggestion = {
  title: string
  detail: string
  focus: string
}

export type PersonalQuestMonthDay = {
  date: string
  dayLabel: string
  inMonth: boolean
  completedCount: number
  totalCount: number
  xp: number
  ipaCount: number
  frozen: boolean
  intensity: 0 | 1 | 2 | 3 | 4
}

export type PersonalQuestMonthView = {
  monthLabel: string
  days: PersonalQuestMonthDay[]
}

export type PersonalQuestPhotoGuidance = {
  id: string
  title: string
  detail: string
  status: 'ready' | 'due' | 'empty'
}

export type WeeklyBossProgress = {
  key: WeeklyBossKey
  title: string
  value: number
  target: number
  xp: number
  completed: boolean
  progress: number
  label: string
}

export const PERSONAL_DAILY_QUESTS: PersonalQuestDefinition[] = [
  { id: 'protein_breakfast', title: 'Eggs / protein breakfast', shortTitle: 'Protein breakfast', xp: 10 },
  { id: 'no_chips_lunch', title: 'No chips with lunch', shortTitle: 'Chip-free lunch', xp: 15, bossKey: 'lunch' },
  { id: 'creamer_goal', title: 'Creamer goal met', shortTitle: 'Creamer goal', xp: 10, bossKey: 'creamer' },
  { id: 'water_80_oz', title: '80 oz water', shortTitle: 'Water goal', xp: 10, bossKey: 'water' },
  { id: 'activity_20_min', title: 'Tennis / activity / 20 min movement', shortTitle: 'Movement', xp: 15 },
  { id: 'core_workout', title: 'Core workout', shortTitle: 'Core', xp: 10 },
  { id: 'alcohol_limit', title: 'No alcohol OR max 2 IPAs', shortTitle: 'IPA limit', xp: 15 },
  { id: 'no_food_after_8', title: 'No food after 8 PM', shortTitle: 'Kitchen closed', xp: 10 },
]

export const PERSONAL_LEVELS: PersonalQuestLevel[] = [
  { title: 'Rookie', xp: 0 },
  { title: 'Competitor', xp: 500 },
  { title: 'Warrior', xp: 1000 },
  { title: 'Grinder', xp: 2000 },
  { title: 'Lean Machine', xp: 3500 },
  { title: 'Visible Abs', xp: 5000 },
  { title: 'Six Pack Mode', xp: 7500 },
]

export const PERSONAL_ACHIEVEMENTS: AchievementDefinition[] = [
  { id: 'lunch_legend', title: 'Lunch Legend', target: 10, metric: 'chipFreeLunches' },
  { id: 'creamer_crusher', title: 'Creamer Crusher', target: 30, metric: 'creamerDays' },
  { id: 'beer_slayer', title: 'Beer Slayer', target: 4, metric: 'ipaGoalWeeks' },
  { id: 'water_warrior', title: 'Water Warrior', target: 14, metric: 'waterDays' },
  { id: 'court_warrior', title: 'Court Warrior', target: 20, metric: 'activitySessions' },
  { id: 'core_machine', title: 'Core Machine', target: 30, metric: 'coreWorkouts' },
  { id: 'streak_7', title: '7-Day Streak', target: 7, metric: 'streak' },
  { id: 'streak_30', title: '30-Day Streak', target: 30, metric: 'streak' },
  { id: 'streak_60', title: '60-Day Streak', target: 60, metric: 'streak' },
  { id: 'streak_90', title: '90-Day Streak', target: 90, metric: 'streak' },
]

const QUEST_BY_ID = new Map(PERSONAL_DAILY_QUESTS.map((quest) => [quest.id, quest]))
const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_WEEKLY_RULE = 'No chips. Water before coffee refill. Kitchen closed at 8.'
const PHOTO_GUIDANCE_TYPES: Array<{
  id: ProgressPhotoType
  label: string
  title: string
  empty: string
}> = [
  { id: 'front', label: 'front', title: 'Front checkpoint', empty: 'Take the first front photo with neutral posture and consistent light.' },
  { id: 'side', label: 'side', title: 'Side checkpoint', empty: 'Take the first side photo from the same distance each time.' },
  { id: 'flex', label: 'flex', title: 'Flex checkpoint', empty: 'Use the same pose and lighting for clean visual comparison.' },
]

export function isPersonalQuestOwner(user: { id?: string | null; email?: string | null } | null | undefined) {
  if (!user) return false
  const userId = cleanText(user.id)
  const email = cleanText(user.email).toLowerCase()
  return Boolean(
    (userId && PERSONAL_QUEST_OWNER_IDS.includes(userId)) ||
    (email && PERSONAL_QUEST_OWNER_EMAILS.includes(email)),
  )
}

export function getQuestXp(questId: string) {
  return QUEST_BY_ID.get(questId as PersonalQuestId)?.xp ?? 0
}

export function getDefaultPersonalQuestRule() {
  return DEFAULT_WEEKLY_RULE
}

export function getTodayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA')
}

export function getWeekStartKey(date = new Date()) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = local.getDay()
  local.setDate(local.getDate() - day)
  return getTodayKey(local)
}

export function getWeekEndKey(weekStart: string) {
  const date = parseDateKey(weekStart)
  date.setDate(date.getDate() + 6)
  return getTodayKey(date)
}

export function getDateOffsetKey(value: string, offsetDays: number) {
  const date = parseDateKey(value)
  date.setDate(date.getDate() + offsetDays)
  return getTodayKey(date)
}

export function buildPersonalQuestStats(input: {
  completions: DailyQuestCompletion[]
  logs: DailyLog[]
  freezes?: PersonalStreakFreeze[]
  today: string
  weekStart: string
}): PersonalQuestStats {
  const dailyXp = input.completions.reduce((sum, item) => sum + Math.max(0, item.xp_awarded || getQuestXp(item.quest_id)), 0)
  const weekEnd = getWeekEndKey(input.weekStart)
  const weeklyCompletions = input.completions.filter(
    (item) => item.completed_on >= input.weekStart && item.completed_on <= weekEnd,
  )
  const weeklyQuestXp = weeklyCompletions.reduce((sum, item) => sum + Math.max(0, item.xp_awarded || getQuestXp(item.quest_id)), 0)
  const currentStreak = calculateCurrentStreak(input.completions, input.freezes ?? [], input.today)
  const bosses = calculateWeeklyBosses(weeklyCompletions, input.logs, input.weekStart, weekEnd, input.today)
  const weeklyBossXp = bosses.filter((boss) => boss.completed).reduce((sum, boss) => sum + boss.xp, 0)
  const totalXp = dailyXp + calculateAllTimeBossXp(input.completions, input.logs, input.today)
  const weeklyXp = weeklyQuestXp + weeklyBossXp
  const { level, nextLevel, xpIntoLevel, xpForNextLevel, levelProgress } = calculateLevel(totalXp)
  const achievements = calculateAchievements(input.completions, input.logs, currentStreak, input.today).map((achievement) => ({
    ...achievement.definition,
    progress: achievement.progress,
    unlocked: achievement.progress >= achievement.definition.target,
  }))
  const nextLockedAchievement = achievements.find((achievement) => !achievement.unlocked)

  return {
    totalXp,
    dailyXp,
    weeklyXp,
    weeklyQuestXp,
    weeklyBossXp,
    currentStreak,
    level,
    nextLevel,
    xpIntoLevel,
    xpForNextLevel,
    levelProgress,
    nextMilestone: nextLevel
      ? `${nextLevel.title} at ${nextLevel.xp.toLocaleString()} XP`
      : nextLockedAchievement
        ? nextLockedAchievement.title
        : 'Season boss cleared',
    achievements,
    bosses,
  }
}

export function buildPersonalQuestHeatmap(input: {
  completions: DailyQuestCompletion[]
  today: string
  days?: number
}): PersonalQuestHeatmapDay[] {
  const totalCount = PERSONAL_DAILY_QUESTS.length
  const days = Math.max(1, Math.min(120, input.days ?? 90))
  const completionsByDate = new Map<string, DailyQuestCompletion[]>()

  for (const completion of input.completions) {
    const current = completionsByDate.get(completion.completed_on) ?? []
    current.push(completion)
    completionsByDate.set(completion.completed_on, current)
  }

  const todayDate = parseDateKey(input.today)
  const startDate = new Date(todayDate.getTime() - DAY_MS * (days - 1))

  return Array.from({ length: days }, (_, index) => {
    const date = getTodayKey(new Date(startDate.getTime() + DAY_MS * index))
    const dayCompletions = completionsByDate.get(date) ?? []
    const completedCount = new Set(dayCompletions.map((item) => item.quest_id)).size
    const xp = dayCompletions.reduce((sum, item) => sum + Math.max(0, item.xp_awarded || getQuestXp(item.quest_id)), 0)
    const ratio = totalCount ? completedCount / totalCount : 0
    const intensity = ratio >= 0.875 ? 4 : ratio >= 0.625 ? 3 : ratio >= 0.375 ? 2 : ratio > 0 ? 1 : 0

    return {
      date,
      completedCount,
      totalCount,
      xp,
      intensity,
      isToday: date === input.today,
    }
  })
}

export function buildQuestFeedback(quest: PersonalQuestDefinition, action: 'completed' | 'removed') {
  if (action === 'removed') {
    return `${quest.shortTitle} reopened. XP adjusted.`
  }

  const bossCopy: Partial<Record<WeeklyBossKey, string>> = {
    ipa: 'IPA Boss took damage.',
    lunch: 'Lunch Boss took damage.',
    creamer: 'Creamer Boss took damage.',
    water: 'Water Boss took damage.',
  }

  return `${quest.shortTitle} complete. +${quest.xp} XP. ${quest.bossKey ? bossCopy[quest.bossKey] : 'Streak protected.'}`
}

export function buildSmartQuestRecommendation(input: {
  completions: DailyQuestCompletion[]
  logs: DailyLog[]
  today: string
  weekStart: string
  mode: PersonalQuestMode
}): SmartQuestRecommendation {
  const completedToday = new Set(input.completions.filter((item) => item.completed_on === input.today).map((item) => item.quest_id))
  const incomplete = PERSONAL_DAILY_QUESTS.filter((quest) => !completedToday.has(quest.id))

  if (!incomplete.length) {
    return {
      quest: null,
      reason: 'Daily board cleared. Bank the win and protect the evening.',
      cta: 'All quests done',
    }
  }

  const weekEnd = getWeekEndKey(input.weekStart)
  const weeklyCompletions = input.completions.filter((item) => item.completed_on >= input.weekStart && item.completed_on <= weekEnd)
  const bossNeeds = new Map<PersonalQuestId, string>()
  const lunchDays = countQuestDays(weeklyCompletions, 'no_chips_lunch')
  const creamerDays = countQuestDays(weeklyCompletions, 'creamer_goal')
  const waterDays = countQuestDays(weeklyCompletions, 'water_80_oz')

  if (lunchDays < 5) bossNeeds.set('no_chips_lunch', `Lunch Boss needs ${5 - lunchDays} more chip-free ${5 - lunchDays === 1 ? 'lunch' : 'lunches'}.`)
  if (creamerDays < 5) bossNeeds.set('creamer_goal', `Creamer Boss needs ${5 - creamerDays} more clean ${5 - creamerDays === 1 ? 'day' : 'days'}.`)
  if (waterDays < 5) bossNeeds.set('water_80_oz', `Water Boss needs ${5 - waterDays} more water ${5 - waterDays === 1 ? 'day' : 'days'}.`)

  const priority: PersonalQuestId[] = input.mode === 'morning'
    ? ['protein_breakfast', 'water_80_oz', 'no_chips_lunch', 'creamer_goal', 'activity_20_min', 'core_workout', 'alcohol_limit', 'no_food_after_8']
    : input.mode === 'recovery'
      ? ['water_80_oz', 'creamer_goal', 'protein_breakfast', 'no_food_after_8', 'core_workout', 'alcohol_limit', 'no_chips_lunch', 'activity_20_min']
      : ['water_80_oz', 'core_workout', 'alcohol_limit', 'no_food_after_8', 'activity_20_min', 'no_chips_lunch', 'creamer_goal', 'protein_breakfast']

  const bossQuest = priority
    .map((id) => incomplete.find((quest) => quest.id === id && bossNeeds.has(id)))
    .find(Boolean)
  const quest = bossQuest ?? priority.map((id) => incomplete.find((item) => item.id === id)).find(Boolean) ?? incomplete[0]
  const modeReason = input.mode === 'morning'
    ? 'Morning mode favors early, low-friction points.'
    : input.mode === 'recovery'
      ? 'Recovery mode keeps the streak alive with the smallest useful wins.'
      : 'Evening mode protects the close: core, IPA limit, and kitchen closed.'

  return {
    quest,
    reason: bossNeeds.get(quest.id) ?? modeReason,
    cta: `Complete ${quest.shortTitle}`,
  }
}

export function buildPersonalQuestTrendCards(input: {
  completions: DailyQuestCompletion[]
  logs: DailyLog[]
  measurements: Measurement[]
  today: string
  weekStart: string
}): PersonalQuestTrendCard[] {
  const currentWeekEnd = getWeekEndKey(input.weekStart)
  const previousWeekStart = getTodayKey(new Date(parseDateKey(input.weekStart).getTime() - DAY_MS * 7))
  const previousWeekEnd = getWeekEndKey(previousWeekStart)
  const currentCompletions = input.completions.filter((item) => item.completed_on >= input.weekStart && item.completed_on <= currentWeekEnd)
  const previousCompletions = input.completions.filter((item) => item.completed_on >= previousWeekStart && item.completed_on <= previousWeekEnd)
  const currentWeekQuestDays = new Set(currentCompletions.map((item) => item.completed_on)).size || 1
  const avgQuests = currentCompletions.length / currentWeekQuestDays
  const currentIpas = sumIpas(input.logs, input.weekStart, currentWeekEnd)
  const previousIpas = sumIpas(input.logs, previousWeekStart, previousWeekEnd)
  const sortedMeasurements = [...input.measurements]
    .filter((item) => typeof item.waist_inches === 'number')
    .sort((a, b) => b.measured_on.localeCompare(a.measured_on))
  const latestWaist = sortedMeasurements[0]?.waist_inches ?? null
  const priorWaist = sortedMeasurements.find((item) => item.measured_on < (sortedMeasurements[0]?.measured_on ?? ''))?.waist_inches ?? null
  const habitCounts = PERSONAL_DAILY_QUESTS.map((quest) => ({
    quest,
    current: countQuestDays(currentCompletions, quest.id),
    previous: countQuestDays(previousCompletions, quest.id),
  }))
  const best = [...habitCounts].sort((a, b) => b.current - a.current || b.previous - a.previous)[0]
  const weakest = [...habitCounts].sort((a, b) => a.current - b.current || a.previous - b.previous)[0]

  return [
    {
      label: 'Waist trend',
      value: latestWaist === null ? 'Set baseline' : `${latestWaist}"`,
      detail: latestWaist !== null && priorWaist !== null ? formatSignedDelta(latestWaist - priorWaist) : 'Weekly measurement',
      tone: latestWaist !== null && priorWaist !== null && latestWaist <= priorWaist ? 'green' : 'blue',
    },
    {
      label: 'Avg quests/day',
      value: avgQuests.toFixed(1),
      detail: `${currentCompletions.length} completions this week`,
      tone: avgQuests >= 5 ? 'green' : 'blue',
    },
    {
      label: 'IPA trend',
      value: `${currentIpas}`,
      detail: previousIpas ? `${formatSignedDelta(currentIpas - previousIpas)} vs last week` : 'This week total',
      tone: previousIpas && currentIpas > previousIpas ? 'amber' : 'green',
    },
    {
      label: 'Best habit',
      value: best?.quest.shortTitle ?? 'Start',
      detail: best ? `${best.current}/7 this week` : 'No completions yet',
      tone: 'green',
    },
    {
      label: 'Weakest habit',
      value: weakest?.quest.shortTitle ?? 'Start',
      detail: weakest ? `${weakest.current}/7 this week` : 'Pick one next',
      tone: weakest && weakest.current <= 1 ? 'amber' : 'blue',
    },
  ]
}

export function buildPersonalQuestBossForecast(input: {
  completions: DailyQuestCompletion[]
  logs: DailyLog[]
  today: string
  weekStart: string
}): PersonalQuestBossForecast[] {
  const weekEnd = getWeekEndKey(input.weekStart)
  const daysLeft = Math.max(0, Math.ceil((parseDateKey(weekEnd).getTime() - parseDateKey(input.today).getTime()) / DAY_MS))
  const weeklyCompletions = input.completions.filter((item) => item.completed_on >= input.weekStart && item.completed_on <= weekEnd)
  const ipaCount = sumIpas(input.logs, input.weekStart, weekEnd)
  const lunchDays = countQuestDays(weeklyCompletions, 'no_chips_lunch')
  const creamerDays = countQuestDays(weeklyCompletions, 'creamer_goal')
  const waterDays = countQuestDays(weeklyCompletions, 'water_80_oz')

  return [
    buildIpaForecast(ipaCount, daysLeft),
    buildCountForecast('lunch', 'Lunch Boss', lunchDays, 5, daysLeft, 'chip-free lunches'),
    buildCountForecast('creamer', 'Creamer Boss', creamerDays, 5, daysLeft, 'creamer days'),
    buildCountForecast('water', 'Water Boss', waterDays, 5, daysLeft, 'water days'),
  ]
}

export function buildPersonalQuestCombos(input: {
  completions: DailyQuestCompletion[]
  today: string
}): PersonalQuestCombo[] {
  const completedToday = new Set(input.completions.filter((item) => item.completed_on === input.today).map((item) => item.quest_id))
  const combos: Array<{ id: string; title: string; detail: string; questIds: PersonalQuestId[] }> = [
    {
      id: 'clean_lunch_stack',
      title: 'Clean Lunch Stack',
      detail: 'Chip-free lunch, creamer goal, and water goal.',
      questIds: ['no_chips_lunch', 'creamer_goal', 'water_80_oz'],
    },
    {
      id: 'court_core_stack',
      title: 'Court + Core Stack',
      detail: 'Movement plus core workout.',
      questIds: ['activity_20_min', 'core_workout'],
    },
    {
      id: 'evening_lockdown',
      title: 'Evening Lockdown',
      detail: 'IPA limit and kitchen closed.',
      questIds: ['alcohol_limit', 'no_food_after_8'],
    },
  ]

  return combos.map((combo) => {
    const completeCount = combo.questIds.filter((id) => completedToday.has(id)).length
    return {
      id: combo.id,
      title: combo.title,
      detail: combo.detail,
      completed: completeCount === combo.questIds.length,
      progress: Math.round((completeCount / combo.questIds.length) * 100),
    }
  })
}

export function buildPersonalQuestGamePlan(input: {
  completions: DailyQuestCompletion[]
  logs: DailyLog[]
  today: string
  weekStart: string
  mode: PersonalQuestMode
}): PersonalQuestGamePlan {
  const completedToday = new Set(input.completions.filter((item) => item.completed_on === input.today).map((item) => item.quest_id))
  const smartQuest = buildSmartQuestRecommendation(input)
  const forecast = buildPersonalQuestBossForecast(input)
  const danger = forecast.find((item) => item.status === 'at-risk') ?? forecast.find((item) => item.status === 'needs-action')
  const lowEffortOrder: PersonalQuestId[] = ['creamer_goal', 'water_80_oz', 'protein_breakfast', 'no_food_after_8', 'core_workout']
  const lowestEffort = lowEffortOrder
    .map((id) => PERSONAL_DAILY_QUESTS.find((quest) => quest.id === id && !completedToday.has(id)))
    .find(Boolean)
  const doNotMiss = danger?.key === 'lunch'
    ? 'Chip-free lunch protects the week.'
    : danger?.key === 'creamer'
      ? 'Creamer goal is the small hinge today.'
      : danger?.key === 'water'
        ? 'Water goal keeps the boss board alive.'
        : danger?.key === 'ipa'
          ? 'Hold the IPA line tonight.'
          : smartQuest.quest
            ? `${smartQuest.quest.shortTitle} keeps momentum clean.`
            : 'Do not turn a cleared board into extra work.'

  return {
    winCondition: smartQuest.quest ? `Complete ${smartQuest.quest.shortTitle}.` : 'Board cleared. Protect the close.',
    doNotMiss,
    lowestEffortXp: lowestEffort ? `${lowestEffort.shortTitle}: +${lowestEffort.xp} XP` : 'No easy XP left.',
    bossDanger: danger ? `${danger.title}: ${danger.headline}.` : 'No boss danger right now.',
  }
}

export function buildPersonalQuestLoadouts(input: {
  completions: DailyQuestCompletion[]
  logs: DailyLog[]
  today: string
  weekStart: string
}): PersonalQuestLoadout[] {
  const completedToday = new Set(input.completions.filter((item) => item.completed_on === input.today).map((item) => item.quest_id))
  const day = parseDateKey(input.today).getDay()
  const ipaCount = sumIpas(input.logs, input.weekStart, getWeekEndKey(input.weekStart))
  const loadouts: Array<Omit<PersonalQuestLoadout, 'progress' | 'completed' | 'recommended'>> = [
    {
      id: 'tennis_day',
      title: 'Tennis Day',
      detail: 'Fuel early, move, hydrate, close clean.',
      questIds: ['protein_breakfast', 'water_80_oz', 'activity_20_min', 'core_workout', 'no_food_after_8'],
    },
    {
      id: 'busy_workday',
      title: 'Busy Workday',
      detail: 'Low-friction points that survive meetings.',
      questIds: ['protein_breakfast', 'creamer_goal', 'water_80_oz', 'no_chips_lunch'],
    },
    {
      id: 'travel_day',
      title: 'Travel Day',
      detail: 'Portable guardrails with no perfect-day tax.',
      questIds: ['water_80_oz', 'no_chips_lunch', 'alcohol_limit', 'no_food_after_8'],
    },
    {
      id: 'recovery_day',
      title: 'Recovery Day',
      detail: 'Keep the streak warm without forcing volume.',
      questIds: ['water_80_oz', 'creamer_goal', 'core_workout', 'no_food_after_8'],
    },
    {
      id: 'weekend_defense',
      title: 'Weekend Defense',
      detail: 'Protect IPA, lunch, and kitchen-close bosses.',
      questIds: ['no_chips_lunch', 'water_80_oz', 'alcohol_limit', 'no_food_after_8'],
    },
  ]

  const recommendedId = day === 0 || day === 6
    ? 'weekend_defense'
    : ipaCount >= 5
      ? 'travel_day'
      : 'busy_workday'

  return loadouts.map((loadout) => {
    const completeCount = loadout.questIds.filter((id) => completedToday.has(id)).length
    return {
      ...loadout,
      progress: Math.round((completeCount / loadout.questIds.length) * 100),
      completed: completeCount === loadout.questIds.length,
      recommended: loadout.id === recommendedId,
    }
  })
}

export function buildPersonalQuestSeasonMap(totalXp: number): PersonalQuestSeasonNode[] {
  return PERSONAL_LEVELS.map((level, index) => {
    const next = PERSONAL_LEVELS[index + 1] ?? null
    const progress = next
      ? Math.max(0, Math.min(100, Math.round(((totalXp - level.xp) / Math.max(1, next.xp - level.xp)) * 100)))
      : totalXp >= level.xp ? 100 : 0
    return {
      ...level,
      status: totalXp >= (next?.xp ?? level.xp) ? 'cleared' : totalXp >= level.xp ? 'current' : 'locked',
      progress,
    }
  })
}

export function buildWeeklyBossStrategy(input: {
  forecast: PersonalQuestBossForecast[]
}): PersonalQuestBossStrategy[] {
  return input.forecast.map((item) => {
    const tone: PersonalQuestBossStrategy['tone'] = item.status === 'at-risk' ? 'red' : item.status === 'needs-action' ? 'amber' : 'green'
    const action = item.key === 'ipa'
      ? item.status === 'at-risk'
        ? 'No more IPAs this week. Bank the reset.'
        : 'Keep tonight inside the limit.'
      : item.key === 'lunch'
        ? 'Make lunch boring and chip-free.'
        : item.key === 'creamer'
          ? 'Stop at the creamer rule before refill.'
          : 'Front-load water before coffee or lunch.'
    return {
      title: item.title,
      headline: item.headline,
      action,
      tone,
    }
  })
}

export function buildStreakFreezeStatus(input: {
  completions: DailyQuestCompletion[]
  freezes: PersonalStreakFreeze[]
  today: string
}): PersonalQuestFreezeStatus {
  const completedToday = input.completions.some((item) => item.completed_on === input.today)
  const protectedToday = input.freezes.some((item) => item.freeze_date === input.today)
  const monthKey = input.today.slice(0, 7)
  const usedThisMonth = new Set(input.freezes.filter((item) => item.freeze_date.startsWith(monthKey)).map((item) => item.freeze_date)).size
  const remainingThisMonth = Math.max(0, 2 - usedThisMonth)
  const canUseToday = !completedToday && !protectedToday && remainingThisMonth > 0

  return {
    usedThisMonth,
    remainingThisMonth,
    canUseToday,
    protectedToday,
    targetDate: input.today,
    detail: protectedToday
      ? 'Today is protected. No XP awarded.'
      : canUseToday
        ? 'Use only if today would otherwise break the streak.'
        : completedToday
          ? 'Today already has quest progress.'
          : 'Monthly freezes are spent.',
  }
}

export function buildPersonalQuestDailyRecap(input: {
  completions: DailyQuestCompletion[]
  logs: DailyLog[]
  freezes: PersonalStreakFreeze[]
  today: string
  weekStart: string
}): PersonalQuestDailyRecap {
  const todayCompletions = input.completions.filter((item) => item.completed_on === input.today)
  const completedCount = new Set(todayCompletions.map((item) => item.quest_id)).size
  const xp = todayCompletions.reduce((sum, item) => sum + Math.max(0, item.xp_awarded || getQuestXp(item.quest_id)), 0)
  const protectedToday = input.freezes.some((item) => item.freeze_date === input.today)
  const bossMisses = buildPersonalQuestBossForecast(input)
    .filter((item) => item.status === 'at-risk' || item.status === 'needs-action')
    .slice(0, 2)
    .map((item) => `${item.title}: ${item.headline}`)
  const missed = PERSONAL_DAILY_QUESTS.find((quest) => !todayCompletions.some((item) => item.quest_id === quest.id))

  return {
    title: completedCount === PERSONAL_DAILY_QUESTS.length ? 'Perfect day locked' : completedCount >= 5 ? 'Strong day' : protectedToday ? 'Streak saved' : 'Still in play',
    xp,
    completedCount,
    totalCount: PERSONAL_DAILY_QUESTS.length,
    streakStatus: protectedToday ? 'Freeze used; streak protected.' : completedCount ? 'Streak alive.' : 'Streak needs a quest.',
    bossMisses,
    tomorrow: missed ? `Open with ${missed.shortTitle}.` : 'Repeat the clean board tomorrow.',
  }
}

export function buildPersonalQuestMomentum(input: {
  completions: DailyQuestCompletion[]
  freezes: PersonalStreakFreeze[]
  today: string
}): PersonalQuestMomentum {
  const total = PERSONAL_DAILY_QUESTS.length
  const todayDate = parseDateKey(input.today)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = getTodayKey(new Date(todayDate.getTime() - DAY_MS * (6 - index)))
    const completedCount = new Set(input.completions.filter((item) => item.completed_on === date).map((item) => item.quest_id)).size
    const frozen = input.freezes.some((item) => item.freeze_date === date)
    const score = Math.max(frozen ? 35 : 0, Math.round((completedCount / total) * 100))
    return {
      date,
      score,
      label: frozen ? 'Freeze' : `${completedCount}/${total}`,
    }
  })
  const score = Math.round(days.reduce((sum, day) => sum + day.score, 0) / days.length)
  const previous = days.slice(0, 4).reduce((sum, day) => sum + day.score, 0) / 4
  const recent = days.slice(4).reduce((sum, day) => sum + day.score, 0) / 3
  const trend = recent > previous + 6 ? 'up' : recent < previous - 6 ? 'down' : 'steady'

  return {
    score,
    label: score >= 80 ? 'Surging' : score >= 60 ? 'Building' : score >= 40 ? 'Uneven' : 'Needs spark',
    detail: trend === 'up' ? 'Last 3 days are stronger.' : trend === 'down' ? 'Last 3 days are slipping.' : 'Last 7 days are steady.',
    trend,
    days,
  }
}

export function buildPersonalQuestBossCalendar(input: {
  completions: DailyQuestCompletion[]
  logs: DailyLog[]
  today: string
  weekStart: string
}): PersonalQuestBossCalendarItem[] {
  const weekEnd = getWeekEndKey(input.weekStart)
  const daysLeft = Math.max(0, Math.ceil((parseDateKey(weekEnd).getTime() - parseDateKey(input.today).getTime()) / DAY_MS))
  const weeklyCompletions = input.completions.filter((item) => item.completed_on >= input.weekStart && item.completed_on <= weekEnd)
  const ipaCount = sumIpas(input.logs, input.weekStart, weekEnd)
  const ipaRemaining = 6 - ipaCount
  const countItems: Array<{ key: WeeklyBossKey; title: string; value: number; target: number; unit: string }> = [
    { key: 'lunch', title: 'Lunch Boss', value: countQuestDays(weeklyCompletions, 'no_chips_lunch'), target: 5, unit: 'chip-free lunches' },
    { key: 'creamer', title: 'Creamer Boss', value: countQuestDays(weeklyCompletions, 'creamer_goal'), target: 5, unit: 'creamer days' },
    { key: 'water', title: 'Water Boss', value: countQuestDays(weeklyCompletions, 'water_80_oz'), target: 5, unit: 'water days' },
  ]

  return [
    {
      key: 'ipa',
      title: 'IPA Budget',
      headline: ipaRemaining >= 0 ? `${ipaRemaining} left` : `${Math.abs(ipaRemaining)} over`,
      detail: `${daysLeft ? `${daysLeft} days left` : 'Week ends tonight'}; goal <= 6.`,
      progress: Math.max(0, Math.min(100, Math.round((Math.max(0, ipaRemaining) / 6) * 100))),
      tone: ipaRemaining < 0 ? 'red' : ipaRemaining <= 1 ? 'amber' : 'green',
    },
    ...countItems.map((item) => {
      const needed = Math.max(0, item.target - item.value)
      const tone: PersonalQuestBossCalendarItem['tone'] = needed === 0 ? 'green' : needed > daysLeft + 1 ? 'red' : needed > daysLeft ? 'amber' : 'green'
      return {
        key: item.key,
        title: item.title,
        headline: needed ? `${needed} needed` : 'Done',
        detail: `${item.value}/${item.target} ${item.unit}; ${daysLeft ? `${daysLeft} days left` : 'week ends tonight'}.`,
        progress: Math.min(100, Math.round((item.value / item.target) * 100)),
        tone,
      }
    }),
  ]
}

export function buildPersonalQuestReminders(input: {
  completions: DailyQuestCompletion[]
  today: string
  isSunday: boolean
}): PersonalQuestReminder[] {
  const completedToday = new Set(input.completions.filter((item) => item.completed_on === input.today).map((item) => item.quest_id))
  return [
    {
      id: 'morning',
      title: 'Morning stack',
      time: 'AM',
      detail: 'Protein, creamer, water.',
      active: !completedToday.has('protein_breakfast') || !completedToday.has('creamer_goal') || !completedToday.has('water_80_oz'),
    },
    {
      id: 'lunch',
      title: 'Lunch boss',
      time: 'Lunch',
      detail: 'Chip-free lunch keeps the weekly boss alive.',
      active: !completedToday.has('no_chips_lunch'),
    },
    {
      id: 'close',
      title: '8 PM close',
      time: 'Night',
      detail: 'IPA limit and kitchen closed.',
      active: !completedToday.has('alcohol_limit') || !completedToday.has('no_food_after_8'),
    },
    {
      id: 'review',
      title: 'Sunday review',
      time: 'Sun',
      detail: 'Waist, wins, misses, next focus.',
      active: input.isSunday,
    },
  ]
}

export function buildPersonalQuestWaistTrend(measurements: Measurement[]): PersonalQuestWaistTrend {
  const points = [...measurements]
    .filter((item): item is Measurement & { waist_inches: number } => typeof item.waist_inches === 'number')
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
    .slice(-8)
  const values = points.map((point) => point.waist_inches)
  const latest = values.at(-1) ?? null
  const first = values[0] ?? null
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 0
  const delta = latest !== null && first !== null ? Math.round((latest - first) * 10) / 10 : null

  return {
    latest,
    delta,
    label: latest === null ? 'Set baseline' : delta === null ? 'Baseline set' : `${formatSignedDelta(delta)} since first point`,
    points: points.map((point) => ({
      date: point.measured_on,
      value: point.waist_inches,
      progress: max === min ? 50 : Math.round(((max - point.waist_inches) / (max - min)) * 100),
    })),
  }
}

export function buildPersonalQuestAchievementDetails(
  achievements: Array<AchievementDefinition & { progress: number; unlocked: boolean }>,
): PersonalQuestAchievementDetail[] {
  return achievements.map((achievement) => {
    const remaining = Math.max(0, achievement.target - achievement.progress)
    return {
      ...achievement,
      remaining,
      fastestPath: achievement.unlocked
        ? 'Unlocked. Keep it banked.'
        : buildAchievementFastPath(achievement.metric, remaining),
    }
  })
}

export function buildPersonalQuestFinale(totalXp: number): PersonalQuestFinale {
  const target = 5000
  const unlocked = totalXp >= target
  return {
    unlocked,
    progress: Math.min(100, Math.round((totalXp / target) * 100)),
    title: unlocked ? 'Visible Abs Week' : 'Final Boss Locked',
    detail: unlocked ? 'Season 1 finale is open.' : `${Math.max(0, target - totalXp).toLocaleString()} XP until Visible Abs Week.`,
    challenge: unlocked
      ? 'Clear 6 of 8 quests for 7 straight days and finish Sunday review.'
      : 'Keep stacking daily quests and weekly boss XP.',
    badge: 'Visible Abs Week Finisher',
  }
}

export function buildPersonalQuestRepairSummary(input: {
  completions: DailyQuestCompletion[]
  logs: DailyLog[]
  date: string
}): PersonalQuestRepairSummary {
  const dayCompletions = input.completions.filter((item) => item.completed_on === input.date)
  const completedCount = new Set(dayCompletions.map((item) => item.quest_id)).size
  const xp = dayCompletions.reduce((sum, item) => sum + Math.max(0, item.xp_awarded || getQuestXp(item.quest_id)), 0)
  const ipaCount = input.logs.find((log) => log.log_date === input.date)?.ipa_count ?? 0
  const status: PersonalQuestRepairSummary['status'] = completedCount === 0
    ? 'empty'
    : completedCount === PERSONAL_DAILY_QUESTS.length
      ? 'complete'
      : 'partial'

  return {
    date: input.date,
    completedCount,
    totalCount: PERSONAL_DAILY_QUESTS.length,
    xp,
    ipaCount,
    status,
  }
}

export function buildWeeklyFocusSuggestion(input: {
  completions: DailyQuestCompletion[]
  logs: DailyLog[]
  today: string
  weekStart: string
}): PersonalQuestFocusSuggestion {
  const weekEnd = getWeekEndKey(input.weekStart)
  const weeklyCompletions = input.completions.filter((item) => item.completed_on >= input.weekStart && item.completed_on <= weekEnd)
  const ipaCount = sumIpas(input.logs, input.weekStart, weekEnd)
  const focusCandidates: Array<{
    title: string
    detail: string
    focus: string
    need: number
    priority: number
  }> = [
    {
      title: 'Protect IPA Boss',
      detail: `${Math.max(0, 6 - ipaCount)} IPAs left against the weekly goal.`,
      focus: 'Keep IPA count <= 6 and close nights clean.',
      need: Math.max(0, ipaCount - 4),
      priority: 4,
    },
    {
      title: 'Own lunch',
      detail: `${countQuestDays(weeklyCompletions, 'no_chips_lunch')}/5 chip-free lunches banked.`,
      focus: 'Make lunch automatic: no chips, water first, no negotiation.',
      need: Math.max(0, 5 - countQuestDays(weeklyCompletions, 'no_chips_lunch')),
      priority: 3,
    },
    {
      title: 'Front-load water',
      detail: `${countQuestDays(weeklyCompletions, 'water_80_oz')}/5 water days banked.`,
      focus: 'Finish water earlier so the evening does not carry the whole day.',
      need: Math.max(0, 5 - countQuestDays(weeklyCompletions, 'water_80_oz')),
      priority: 2,
    },
    {
      title: 'Lock creamer',
      detail: `${countQuestDays(weeklyCompletions, 'creamer_goal')}/5 creamer-goal days banked.`,
      focus: 'Keep the creamer rule tight before the second coffee.',
      need: Math.max(0, 5 - countQuestDays(weeklyCompletions, 'creamer_goal')),
      priority: 1,
    },
  ]

  const best = focusCandidates.sort((a, b) => b.need - a.need || b.priority - a.priority)[0]
  if (!best || best.need === 0) {
    return {
      title: 'Repeat the clean board',
      detail: 'Bosses are stable. Keep the same simple rule set.',
      focus: 'Repeat the current weekly rule and protect the Sunday review.',
    }
  }

  return {
    title: best.title,
    detail: best.detail,
    focus: best.focus,
  }
}

export function buildPersonalQuestMonthView(input: {
  completions: DailyQuestCompletion[]
  logs: DailyLog[]
  freezes: PersonalStreakFreeze[]
  today: string
}): PersonalQuestMonthView {
  const totalCount = PERSONAL_DAILY_QUESTS.length
  const todayDate = parseDateKey(input.today)
  const firstOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay())
  const completionsByDate = new Map<string, DailyQuestCompletion[]>()

  for (const completion of input.completions) {
    const current = completionsByDate.get(completion.completed_on) ?? []
    current.push(completion)
    completionsByDate.set(completion.completed_on, current)
  }

  const days = Array.from({ length: 42 }, (_, index): PersonalQuestMonthDay => {
    const date = new Date(gridStart.getTime() + DAY_MS * index)
    const key = getTodayKey(date)
    const dayCompletions = completionsByDate.get(key) ?? []
    const completedCount = new Set(dayCompletions.map((item) => item.quest_id)).size
    const xp = dayCompletions.reduce((sum, item) => sum + Math.max(0, item.xp_awarded || getQuestXp(item.quest_id)), 0)
    const ratio = totalCount ? completedCount / totalCount : 0
    const frozen = input.freezes.some((freeze) => freeze.freeze_date === key)
    const intensity: PersonalQuestMonthDay['intensity'] = ratio >= 0.875 ? 4 : ratio >= 0.625 ? 3 : ratio >= 0.375 ? 2 : ratio > 0 || frozen ? 1 : 0

    return {
      date: key,
      dayLabel: String(date.getDate()),
      inMonth: date.getMonth() === todayDate.getMonth(),
      completedCount,
      totalCount,
      xp,
      ipaCount: input.logs.find((log) => log.log_date === key)?.ipa_count ?? 0,
      frozen,
      intensity,
    }
  })

  return {
    monthLabel: firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    days,
  }
}

export function buildPhotoCaptureGuidance(photos: ProgressPhoto[], today: string): PersonalQuestPhotoGuidance[] {
  const daysSince = (capturedOn: string | undefined) => capturedOn ? Math.max(0, Math.floor((parseDateKey(today).getTime() - parseDateKey(capturedOn).getTime()) / DAY_MS)) : null
  const latestByType = new Map<ProgressPhotoType, ProgressPhoto>()

  for (const photo of photos) {
    const current = latestByType.get(photo.photo_type)
    if (!current || (photo.captured_on ?? photo.created_at) > (current.captured_on ?? current.created_at)) {
      latestByType.set(photo.photo_type, photo)
    }
  }

  return PHOTO_GUIDANCE_TYPES.map((item) => {
    const latest = latestByType.get(item.id)
    const age = daysSince(latest?.captured_on)
    const status: PersonalQuestPhotoGuidance['status'] = latest
      ? age !== null && age <= 10 ? 'ready' : 'due'
      : 'empty'
    return {
      id: item.id,
      title: item.title,
      detail: status === 'empty'
        ? item.empty
        : status === 'due'
          ? `${age ?? 0} days since last ${item.label}. Keep the same angle and lighting.`
          : `Last ${item.label} is ${age ?? 0} days old. Match distance, light, and posture.`,
      status,
    }
  })
}

function buildIpaForecast(ipaCount: number, daysLeft: number): PersonalQuestBossForecast {
  const remaining = 6 - ipaCount
  if (remaining < 0) {
    return {
      key: 'ipa',
      title: 'IPA Boss',
      status: 'at-risk',
      headline: `${Math.abs(remaining)} over goal`,
      detail: 'No more damage control XP this week.',
      progress: 0,
    }
  }

  return {
    key: 'ipa',
    title: 'IPA Boss',
    status: remaining >= Math.max(1, daysLeft) ? 'on-track' : 'needs-action',
    headline: `${remaining} IPAs left`,
    detail: daysLeft ? `${daysLeft} days left in the week.` : 'Week ends tonight.',
    progress: Math.max(0, Math.min(100, Math.round((remaining / 6) * 100))),
  }
}

function buildCountForecast(
  key: WeeklyBossKey,
  title: string,
  value: number,
  target: number,
  daysLeft: number,
  unit: string,
): PersonalQuestBossForecast {
  const remaining = Math.max(0, target - value)
  if (remaining === 0) {
    return {
      key,
      title,
      status: 'complete',
      headline: 'Boss cleared',
      detail: `${value}/${target} ${unit}.`,
      progress: 100,
    }
  }

  return {
    key,
    title,
    status: remaining > daysLeft + 1 ? 'at-risk' : remaining > daysLeft ? 'needs-action' : 'on-track',
    headline: `${remaining} needed`,
    detail: `${value}/${target} ${unit}; ${daysLeft ? `${daysLeft} days left` : 'week ends tonight'}.`,
    progress: Math.min(100, Math.round((value / target) * 100)),
  }
}

function sumIpas(logs: DailyLog[], start: string, end: string) {
  return logs
    .filter((log) => log.log_date >= start && log.log_date <= end)
    .reduce((sum, log) => sum + Math.max(0, log.ipa_count || 0), 0)
}

function formatSignedDelta(value: number) {
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return 'No change'
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

function buildAchievementFastPath(metric: AchievementMetric, remaining: number) {
  const unit = remaining === 1 ? 'more' : 'more'
  if (metric === 'chipFreeLunches') return `${remaining} ${unit} chip-free ${remaining === 1 ? 'lunch' : 'lunches'}.`
  if (metric === 'creamerDays') return `${remaining} ${unit} creamer-goal ${remaining === 1 ? 'day' : 'days'}.`
  if (metric === 'ipaGoalWeeks') return `${remaining} ${unit} IPA-goal ${remaining === 1 ? 'week' : 'weeks'}.`
  if (metric === 'waterDays') return `${remaining} ${unit} water-goal ${remaining === 1 ? 'day' : 'days'}.`
  if (metric === 'activitySessions') return `${remaining} ${unit} movement ${remaining === 1 ? 'session' : 'sessions'}.`
  if (metric === 'coreWorkouts') return `${remaining} ${unit} core ${remaining === 1 ? 'workout' : 'workouts'}.`
  return `${remaining} ${unit} streak ${remaining === 1 ? 'day' : 'days'}.`
}

function calculateLevel(totalXp: number) {
  const sorted = [...PERSONAL_LEVELS].sort((a, b) => a.xp - b.xp)
  const level = [...sorted].reverse().find((item) => totalXp >= item.xp) ?? sorted[0]
  const nextLevel = sorted.find((item) => item.xp > totalXp) ?? null
  const xpIntoLevel = Math.max(0, totalXp - level.xp)
  const xpForNextLevel = nextLevel ? Math.max(1, nextLevel.xp - level.xp) : 1
  const levelProgress = nextLevel ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)) : 100
  return { level, nextLevel, xpIntoLevel, xpForNextLevel, levelProgress }
}

function calculateCurrentStreak(completions: DailyQuestCompletion[], freezes: PersonalStreakFreeze[], today: string) {
  const completedDays = new Set(completions.map((item) => item.completed_on))
  const freezeDays = new Set(freezes.map((item) => item.freeze_date))
  let cursor = parseDateKey(today)
  let streak = 0

  while (completedDays.has(getTodayKey(cursor)) || freezeDays.has(getTodayKey(cursor))) {
    streak += 1
    cursor = new Date(cursor.getTime() - DAY_MS)
  }

  return streak
}

function calculateAchievements(
  completions: DailyQuestCompletion[],
  logs: DailyLog[],
  currentStreak: number,
  today: string,
) {
  const metrics = {
    chipFreeLunches: countQuestDays(completions, 'no_chips_lunch'),
    creamerDays: countQuestDays(completions, 'creamer_goal'),
    ipaGoalWeeks: countIpaGoalWeeks(logs, today),
    waterDays: countQuestDays(completions, 'water_80_oz'),
    activitySessions: countQuestDays(completions, 'activity_20_min'),
    coreWorkouts: countQuestDays(completions, 'core_workout'),
    streak: currentStreak,
  } satisfies Record<AchievementMetric, number>

  return PERSONAL_ACHIEVEMENTS.map((definition) => ({
    definition,
    progress: metrics[definition.metric],
  }))
}

function calculateWeeklyBosses(
  weeklyCompletions: DailyQuestCompletion[],
  logs: DailyLog[],
  weekStart: string,
  weekEnd: string,
  today: string,
): WeeklyBossProgress[] {
  const ipaCount = logs
    .filter((log) => log.log_date >= weekStart && log.log_date <= weekEnd)
    .reduce((sum, log) => sum + Math.max(0, log.ipa_count || 0), 0)
  const ipaWeekComplete = today >= weekEnd
  const lunchDays = countQuestDays(weeklyCompletions, 'no_chips_lunch')
  const creamerDays = countQuestDays(weeklyCompletions, 'creamer_goal')
  const waterDays = countQuestDays(weeklyCompletions, 'water_80_oz')

  return [
    {
      key: 'ipa',
      title: 'IPA Boss',
      value: ipaCount,
      target: 6,
      xp: 60,
      completed: ipaWeekComplete && ipaCount <= 6,
      progress: Math.max(0, Math.min(100, Math.round(((6 - ipaCount) / 6) * 100))),
      label: `${ipaCount}/6 IPAs`,
    },
    buildCountBoss('lunch', 'Lunch Boss', lunchDays, 5, 45, 'chip-free lunches'),
    buildCountBoss('creamer', 'Creamer Boss', creamerDays, 5, 35, 'creamer days'),
    buildCountBoss('water', 'Water Boss', waterDays, 5, 35, 'water days'),
  ]
}

function calculateAllTimeBossXp(completions: DailyQuestCompletion[], logs: DailyLog[], today: string) {
  const weekStarts = new Set<string>()
  for (const completion of completions) {
    weekStarts.add(getWeekStartKey(parseDateKey(completion.completed_on)))
  }
  for (const log of logs) {
    weekStarts.add(getWeekStartKey(parseDateKey(log.log_date)))
  }

  let total = 0
  for (const weekStart of weekStarts) {
    const weekEnd = getWeekEndKey(weekStart)
    const weeklyCompletions = completions.filter(
      (item) => item.completed_on >= weekStart && item.completed_on <= weekEnd,
    )
    total += calculateWeeklyBosses(weeklyCompletions, logs, weekStart, weekEnd, today)
      .filter((boss) => boss.completed)
      .reduce((sum, boss) => sum + boss.xp, 0)
  }

  return total
}

function buildCountBoss(
  key: WeeklyBossKey,
  title: string,
  value: number,
  target: number,
  xp: number,
  unit: string,
): WeeklyBossProgress {
  return {
    key,
    title,
    value,
    target,
    xp,
    completed: value >= target,
    progress: Math.min(100, Math.round((value / target) * 100)),
    label: `${value}/${target} ${unit}`,
  }
}

function countQuestDays(completions: DailyQuestCompletion[], questId: PersonalQuestId) {
  return new Set(completions.filter((item) => item.quest_id === questId).map((item) => item.completed_on)).size
}

function countIpaGoalWeeks(logs: DailyLog[], today: string) {
  const weeks = new Map<string, number>()
  for (const log of logs) {
    const weekStart = getWeekStartKey(parseDateKey(log.log_date))
    weeks.set(weekStart, (weeks.get(weekStart) ?? 0) + Math.max(0, log.ipa_count || 0))
  }
  return Array.from(weeks.entries()).filter(([weekStart, count]) => getWeekEndKey(weekStart) <= today && count <= 6).length
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10))
  if (!year || !month || !day) return new Date()
  return new Date(year, month - 1, day)
}

function splitAllowlist(value: string | undefined) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}
