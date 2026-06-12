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
