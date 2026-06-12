import { describe, expect, it } from 'vitest'
import {
  buildPersonalQuestStats,
  isPersonalQuestOwner,
  type DailyLog,
  type DailyQuestCompletion,
} from '../personal-quest'

describe('personal quest access', () => {
  it('allows Nathan by email and rejects other users', () => {
    expect(isPersonalQuestOwner({ id: 'user-1', email: 'nmeinert91@gmail.com' })).toBe(true)
    expect(isPersonalQuestOwner({ id: 'accc3471-8912-491c-b8d9-4a84dcc7c42e', email: 'other@example.com' })).toBe(true)
    expect(isPersonalQuestOwner({ id: 'user-2', email: 'player@example.com' })).toBe(false)
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
