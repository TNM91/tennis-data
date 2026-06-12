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

export type PersonalQuestMode = 'morning' | 'evening'

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

export function buildPersonalQuestStats(input: {
  completions: DailyQuestCompletion[]
  logs: DailyLog[]
  today: string
  weekStart: string
}): PersonalQuestStats {
  const dailyXp = input.completions.reduce((sum, item) => sum + Math.max(0, item.xp_awarded || getQuestXp(item.quest_id)), 0)
  const weekEnd = getWeekEndKey(input.weekStart)
  const weeklyCompletions = input.completions.filter(
    (item) => item.completed_on >= input.weekStart && item.completed_on <= weekEnd,
  )
  const weeklyQuestXp = weeklyCompletions.reduce((sum, item) => sum + Math.max(0, item.xp_awarded || getQuestXp(item.quest_id)), 0)
  const currentStreak = calculateCurrentStreak(input.completions, input.today)
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
    : ['water_80_oz', 'core_workout', 'alcohol_limit', 'no_food_after_8', 'activity_20_min', 'no_chips_lunch', 'creamer_goal', 'protein_breakfast']

  const bossQuest = priority
    .map((id) => incomplete.find((quest) => quest.id === id && bossNeeds.has(id)))
    .find(Boolean)
  const quest = bossQuest ?? priority.map((id) => incomplete.find((item) => item.id === id)).find(Boolean) ?? incomplete[0]
  const modeReason = input.mode === 'morning'
    ? 'Morning mode favors early, low-friction points.'
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

function calculateLevel(totalXp: number) {
  const sorted = [...PERSONAL_LEVELS].sort((a, b) => a.xp - b.xp)
  const level = [...sorted].reverse().find((item) => totalXp >= item.xp) ?? sorted[0]
  const nextLevel = sorted.find((item) => item.xp > totalXp) ?? null
  const xpIntoLevel = Math.max(0, totalXp - level.xp)
  const xpForNextLevel = nextLevel ? Math.max(1, nextLevel.xp - level.xp) : 1
  const levelProgress = nextLevel ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)) : 100
  return { level, nextLevel, xpIntoLevel, xpForNextLevel, levelProgress }
}

function calculateCurrentStreak(completions: DailyQuestCompletion[], today: string) {
  const completedDays = new Set(completions.map((item) => item.completed_on))
  let cursor = parseDateKey(today)
  let streak = 0

  while (completedDays.has(getTodayKey(cursor))) {
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
