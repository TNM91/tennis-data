import { describe, expect, it } from 'vitest'
import {
  PERSONAL_DAILY_QUESTS,
  buildPersonalQuestHeatmap,
  buildPersonalQuestBossForecast,
  buildPersonalQuestBossCalendar,
  buildPersonalQuestCombos,
  buildPersonalQuestAchievementDetails,
  buildPersonalQuestDailyRecap,
  buildPersonalQuestFinale,
  buildPersonalQuestGamePlan,
  buildPersonalQuestLoadouts,
  buildPersonalQuestMomentum,
  buildPersonalQuestReminders,
  buildPersonalQuestSeasonMap,
  buildPersonalQuestStats,
  buildPersonalQuestTrendCards,
  buildPersonalQuestWaistTrend,
  buildQuestFeedback,
  buildSmartQuestRecommendation,
  buildStreakFreezeStatus,
  buildWeeklyBossStrategy,
  isPersonalQuestOwner,
  type DailyLog,
  type DailyQuestCompletion,
  type Measurement,
  type PersonalStreakFreeze,
} from '../personal-quest'

describe('personal quest access', () => {
  it('allows Nathan by email and rejects other users', () => {
    expect(isPersonalQuestOwner({ id: 'user-1', email: 'nmeinert91@gmail.com' })).toBe(true)
    expect(isPersonalQuestOwner({ id: 'accc3471-8912-491c-b8d9-4a84dcc7c42e', email: 'other@example.com' })).toBe(true)
    expect(isPersonalQuestOwner({ id: 'user-2', email: 'player@example.com' })).toBe(false)
  })
})

describe('personal quest daily helpers', () => {
  it('builds a bounded 90-day heatmap with intensity and today markers', () => {
    const completions: DailyQuestCompletion[] = [
      { quest_id: 'protein_breakfast', completed_on: '2026-06-11', xp_awarded: 10 },
      { quest_id: 'no_chips_lunch', completed_on: '2026-06-12', xp_awarded: 15 },
      { quest_id: 'creamer_goal', completed_on: '2026-06-12', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-12', xp_awarded: 10 },
      { quest_id: 'activity_20_min', completed_on: '2026-06-12', xp_awarded: 15 },
      { quest_id: 'core_workout', completed_on: '2026-06-12', xp_awarded: 10 },
      { quest_id: 'alcohol_limit', completed_on: '2026-06-12', xp_awarded: 15 },
      { quest_id: 'no_food_after_8', completed_on: '2026-06-12', xp_awarded: 10 },
    ]

    const heatmap = buildPersonalQuestHeatmap({ completions, today: '2026-06-12', days: 3 })

    expect(heatmap).toHaveLength(3)
    expect(heatmap[0]).toMatchObject({ date: '2026-06-10', intensity: 0, isToday: false })
    expect(heatmap[1]).toMatchObject({ date: '2026-06-11', completedCount: 1, intensity: 1 })
    expect(heatmap[2]).toMatchObject({ date: '2026-06-12', completedCount: 7, xp: 85, intensity: 4, isToday: true })
  })

  it('returns game feedback for quest completion and removal', () => {
    const lunchQuest = PERSONAL_DAILY_QUESTS.find((quest) => quest.id === 'no_chips_lunch')
    const coreQuest = PERSONAL_DAILY_QUESTS.find((quest) => quest.id === 'core_workout')

    expect(lunchQuest).toBeDefined()
    expect(coreQuest).toBeDefined()
    expect(buildQuestFeedback(lunchQuest!, 'completed')).toContain('Lunch Boss took damage.')
    expect(buildQuestFeedback(coreQuest!, 'completed')).toContain('Streak protected.')
    expect(buildQuestFeedback(coreQuest!, 'removed')).toContain('reopened')
  })

  it('recommends boss-aware next quests by mode', () => {
    const completions: DailyQuestCompletion[] = [
      { quest_id: 'protein_breakfast', completed_on: '2026-06-12', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-12', xp_awarded: 10 },
      { quest_id: 'no_chips_lunch', completed_on: '2026-06-09', xp_awarded: 15 },
    ]
    const logs: DailyLog[] = [{ log_date: '2026-06-12', ipa_count: 1, notes: '' }]

    const recommendation = buildSmartQuestRecommendation({
      completions,
      logs,
      today: '2026-06-12',
      weekStart: '2026-06-07',
      mode: 'morning',
    })

    expect(recommendation.quest?.id).toBe('no_chips_lunch')
    expect(recommendation.reason).toContain('Lunch Boss')
  })

  it('builds weekly trend cards without requiring weight or calories', () => {
    const completions: DailyQuestCompletion[] = [
      { quest_id: 'water_80_oz', completed_on: '2026-06-11', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-12', xp_awarded: 10 },
      { quest_id: 'core_workout', completed_on: '2026-06-12', xp_awarded: 10 },
    ]
    const logs: DailyLog[] = [
      { log_date: '2026-06-05', ipa_count: 4, notes: '' },
      { log_date: '2026-06-12', ipa_count: 1, notes: '' },
    ]
    const measurements: Measurement[] = [
      { measured_on: '2026-06-01', waist_inches: 36 },
      { measured_on: '2026-06-08', waist_inches: 35.5 },
    ]

    const cards = buildPersonalQuestTrendCards({
      completions,
      logs,
      measurements,
      today: '2026-06-12',
      weekStart: '2026-06-07',
    })

    expect(cards.map((card) => card.label)).toEqual([
      'Waist trend',
      'Avg quests/day',
      'IPA trend',
      'Best habit',
      'Weakest habit',
    ])
    expect(cards.find((card) => card.label === 'Waist trend')?.detail).toBe('-0.5')
    expect(cards.find((card) => card.label === 'Best habit')?.value).toBe('Water goal')
  })

  it('forecasts weekly boss risk and completed combos', () => {
    const completions: DailyQuestCompletion[] = [
      { quest_id: 'no_chips_lunch', completed_on: '2026-06-12', xp_awarded: 15 },
      { quest_id: 'creamer_goal', completed_on: '2026-06-12', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-12', xp_awarded: 10 },
      { quest_id: 'alcohol_limit', completed_on: '2026-06-12', xp_awarded: 15 },
      { quest_id: 'no_food_after_8', completed_on: '2026-06-12', xp_awarded: 10 },
    ]
    const logs: DailyLog[] = [{ log_date: '2026-06-12', ipa_count: 7, notes: '' }]

    const forecast = buildPersonalQuestBossForecast({
      completions,
      logs,
      today: '2026-06-12',
      weekStart: '2026-06-07',
    })
    const combos = buildPersonalQuestCombos({ completions, today: '2026-06-12' })

    expect(forecast).toContainEqual(expect.objectContaining({ key: 'ipa', status: 'at-risk' }))
    expect(combos).toContainEqual(expect.objectContaining({ id: 'clean_lunch_stack', completed: true }))
    expect(combos).toContainEqual(expect.objectContaining({ id: 'evening_lockdown', completed: true }))
  })

  it('builds game plan, loadouts, season map, and boss strategy', () => {
    const completions: DailyQuestCompletion[] = [
      { quest_id: 'protein_breakfast', completed_on: '2026-06-12', xp_awarded: 10 },
      { quest_id: 'creamer_goal', completed_on: '2026-06-12', xp_awarded: 10 },
    ]
    const logs: DailyLog[] = [{ log_date: '2026-06-12', ipa_count: 6, notes: '' }]
    const today = '2026-06-12'
    const weekStart = '2026-06-07'
    const forecast = buildPersonalQuestBossForecast({ completions, logs, today, weekStart })

    const gamePlan = buildPersonalQuestGamePlan({ completions, logs, today, weekStart, mode: 'evening' })
    const loadouts = buildPersonalQuestLoadouts({ completions, logs, today, weekStart })
    const seasonMap = buildPersonalQuestSeasonMap(1250)
    const strategy = buildWeeklyBossStrategy({ forecast })

    expect(gamePlan.bossDanger).toContain('Boss')
    expect(loadouts).toContainEqual(expect.objectContaining({ id: 'travel_day', recommended: true }))
    expect(seasonMap).toContainEqual(expect.objectContaining({ title: 'Warrior', status: 'current' }))
    expect(strategy).toContainEqual(expect.objectContaining({ title: 'IPA Boss' }))
  })

  it('uses monthly streak freezes without awarding XP', () => {
    const completions: DailyQuestCompletion[] = [
      { quest_id: 'water_80_oz', completed_on: '2026-06-10', xp_awarded: 10 },
      { quest_id: 'core_workout', completed_on: '2026-06-12', xp_awarded: 10 },
    ]
    const freezes: PersonalStreakFreeze[] = [{ freeze_date: '2026-06-11', reason: 'Save the day' }]
    const logs: DailyLog[] = []

    const stats = buildPersonalQuestStats({
      completions,
      logs,
      freezes,
      today: '2026-06-12',
      weekStart: '2026-06-07',
    })
    const freezeStatus = buildStreakFreezeStatus({
      completions: [],
      freezes,
      today: '2026-06-12',
    })

    expect(stats.currentStreak).toBe(3)
    expect(stats.totalXp).toBe(20)
    expect(freezeStatus.usedThisMonth).toBe(1)
    expect(freezeStatus.remainingThisMonth).toBe(1)
    expect(freezeStatus.canUseToday).toBe(true)
  })

  it('builds recap, momentum, boss calendar, reminders, waist trend, and finale data', () => {
    const completions: DailyQuestCompletion[] = [
      { quest_id: 'water_80_oz', completed_on: '2026-06-08', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-09', xp_awarded: 10 },
      { quest_id: 'core_workout', completed_on: '2026-06-10', xp_awarded: 10 },
      { quest_id: 'protein_breakfast', completed_on: '2026-06-12', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-12', xp_awarded: 10 },
      { quest_id: 'no_food_after_8', completed_on: '2026-06-12', xp_awarded: 10 },
    ]
    const logs: DailyLog[] = [{ log_date: '2026-06-12', ipa_count: 5, notes: '' }]
    const freezes: PersonalStreakFreeze[] = [{ freeze_date: '2026-06-11', reason: 'Save the day' }]
    const measurements: Measurement[] = [
      { measured_on: '2026-05-31', waist_inches: 36 },
      { measured_on: '2026-06-07', waist_inches: 35.5 },
      { measured_on: '2026-06-12', waist_inches: 35 },
    ]
    const today = '2026-06-12'
    const weekStart = '2026-06-07'

    const recap = buildPersonalQuestDailyRecap({ completions, logs, freezes, today, weekStart })
    const momentum = buildPersonalQuestMomentum({ completions, freezes, today })
    const calendar = buildPersonalQuestBossCalendar({ completions, logs, today, weekStart })
    const reminders = buildPersonalQuestReminders({ completions, today, isSunday: false })
    const waist = buildPersonalQuestWaistTrend(measurements)
    const finale = buildPersonalQuestFinale(5100)

    expect(recap.xp).toBe(30)
    expect(momentum.days).toHaveLength(7)
    expect(calendar).toContainEqual(expect.objectContaining({ key: 'ipa', headline: '1 left' }))
    expect(reminders).toContainEqual(expect.objectContaining({ id: 'lunch', active: true }))
    expect(waist.label).toBe('-1 since first point')
    expect(finale.unlocked).toBe(true)
  })

  it('builds achievement drawer details with fastest path copy', () => {
    const details = buildPersonalQuestAchievementDetails([
      { id: 'water_warrior', title: 'Water Warrior', metric: 'waterDays', target: 14, progress: 9, unlocked: false },
      { id: 'streak_7', title: '7-Day Streak', metric: 'streak', target: 7, progress: 7, unlocked: true },
    ])

    expect(details[0]).toMatchObject({ remaining: 5, fastestPath: '5 more water-goal days.' })
    expect(details[1]).toMatchObject({ remaining: 0, fastestPath: 'Unlocked. Keep it banked.' })
  })
})

describe('personal quest stats', () => {
  it('calculates XP, current streak, and in-progress weekly bosses', () => {
    const completions: DailyQuestCompletion[] = [
      { quest_id: 'no_chips_lunch', completed_on: '2026-06-08', xp_awarded: 15 },
      { quest_id: 'creamer_goal', completed_on: '2026-06-08', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-08', xp_awarded: 10 },
      { quest_id: 'activity_20_min', completed_on: '2026-06-08', xp_awarded: 15 },
      { quest_id: 'no_chips_lunch', completed_on: '2026-06-09', xp_awarded: 15 },
      { quest_id: 'creamer_goal', completed_on: '2026-06-09', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-09', xp_awarded: 10 },
      { quest_id: 'no_chips_lunch', completed_on: '2026-06-10', xp_awarded: 15 },
      { quest_id: 'creamer_goal', completed_on: '2026-06-10', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-10', xp_awarded: 10 },
      { quest_id: 'no_chips_lunch', completed_on: '2026-06-11', xp_awarded: 15 },
      { quest_id: 'creamer_goal', completed_on: '2026-06-11', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-11', xp_awarded: 10 },
      { quest_id: 'no_chips_lunch', completed_on: '2026-06-12', xp_awarded: 15 },
      { quest_id: 'creamer_goal', completed_on: '2026-06-12', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-12', xp_awarded: 10 },
    ]
    const logs: DailyLog[] = [
      { log_date: '2026-06-08', ipa_count: 1, notes: '' },
      { log_date: '2026-06-09', ipa_count: 1, notes: '' },
      { log_date: '2026-06-10', ipa_count: 1, notes: '' },
      { log_date: '2026-06-11', ipa_count: 1, notes: '' },
      { log_date: '2026-06-12', ipa_count: 1, notes: '' },
    ]

    const stats = buildPersonalQuestStats({
      completions,
      logs,
      today: '2026-06-12',
      weekStart: '2026-06-07',
    })

    expect(stats.dailyXp).toBe(190)
    expect(stats.totalXp).toBe(305)
    expect(stats.weeklyQuestXp).toBe(190)
    expect(stats.weeklyBossXp).toBe(115)
    expect(stats.weeklyXp).toBe(305)
    expect(stats.currentStreak).toBe(5)
    expect(stats.level.title).toBe('Rookie')
    expect(stats.bosses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'ipa', completed: false, value: 5 }),
        expect.objectContaining({ key: 'lunch', completed: true, value: 5 }),
        expect.objectContaining({ key: 'creamer', completed: true, value: 5 }),
        expect.objectContaining({ key: 'water', completed: true, value: 5 }),
      ]),
    )
  })

  it('awards IPA Boss XP only after the week is complete', () => {
    const completions: DailyQuestCompletion[] = [
      { quest_id: 'no_chips_lunch', completed_on: '2026-06-08', xp_awarded: 15 },
      { quest_id: 'creamer_goal', completed_on: '2026-06-08', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-08', xp_awarded: 10 },
      { quest_id: 'activity_20_min', completed_on: '2026-06-08', xp_awarded: 15 },
      { quest_id: 'no_chips_lunch', completed_on: '2026-06-09', xp_awarded: 15 },
      { quest_id: 'creamer_goal', completed_on: '2026-06-09', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-09', xp_awarded: 10 },
      { quest_id: 'no_chips_lunch', completed_on: '2026-06-10', xp_awarded: 15 },
      { quest_id: 'creamer_goal', completed_on: '2026-06-10', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-10', xp_awarded: 10 },
      { quest_id: 'no_chips_lunch', completed_on: '2026-06-11', xp_awarded: 15 },
      { quest_id: 'creamer_goal', completed_on: '2026-06-11', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-11', xp_awarded: 10 },
      { quest_id: 'no_chips_lunch', completed_on: '2026-06-12', xp_awarded: 15 },
      { quest_id: 'creamer_goal', completed_on: '2026-06-12', xp_awarded: 10 },
      { quest_id: 'water_80_oz', completed_on: '2026-06-12', xp_awarded: 10 },
    ]
    const logs: DailyLog[] = [
      { log_date: '2026-06-08', ipa_count: 1, notes: '' },
      { log_date: '2026-06-09', ipa_count: 1, notes: '' },
      { log_date: '2026-06-10', ipa_count: 1, notes: '' },
      { log_date: '2026-06-11', ipa_count: 1, notes: '' },
      { log_date: '2026-06-12', ipa_count: 1, notes: '' },
    ]

    const stats = buildPersonalQuestStats({
      completions,
      logs,
      today: '2026-06-13',
      weekStart: '2026-06-07',
    })

    expect(stats.weeklyBossXp).toBe(175)
    expect(stats.totalXp).toBe(365)
    expect(stats.bosses).toContainEqual(expect.objectContaining({ key: 'ipa', completed: true, value: 5 }))
    expect(stats.achievements).toContainEqual(expect.objectContaining({ id: 'beer_slayer', progress: 1 }))
  })
})
