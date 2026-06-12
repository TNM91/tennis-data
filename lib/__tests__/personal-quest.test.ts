import { describe, expect, it } from 'vitest'
import {
  PERSONAL_DAILY_QUESTS,
  buildPersonalQuestHeatmap,
  buildPersonalQuestBossForecast,
  buildPersonalQuestCombos,
  buildPersonalQuestStats,
  buildPersonalQuestTrendCards,
  buildQuestFeedback,
  buildSmartQuestRecommendation,
  isPersonalQuestOwner,
  type DailyLog,
  type DailyQuestCompletion,
  type Measurement,
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
