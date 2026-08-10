import { describe, expect, it } from 'vitest'
import {
  LEVEL_UP_QUEST_HANDOFF_KEY,
  buildLevelUpQuestHandoff,
  buildLevelUpTennisStreak,
  chooseLatestLevelUpQuestHandoff,
  parseLevelUpQuestHandoff,
  updateLevelUpQuestHandoffMessage,
} from '../level-up/quest-handoff'

describe('Level Up quest handoff', () => {
  const buildHandoff = (completedAt = '2026-08-10T15:30:00.000Z') => buildLevelUpQuestHandoff({
    sessionId: `session-${completedAt}`,
    identitySlug: 'relentless-competitor-4-0',
    focusId: 'serve-plus-one',
    focusTitle: 'Serve + 1',
    drillTitle: 'Wide serve, open court',
    rating: 4,
    completedAt,
    tennisStreakDays: 3,
    nextRepTitle: 'Body serve pressure rep',
    nextRepCardId: 'serve-body-pressure',
    questCardId: 'serve-wide-open-court',
    customQuestId: 'quest-1',
  })

  it('uses a versioned local contract with direct next-rep and quest-builder actions', () => {
    const handoff = buildHandoff()

    expect(LEVEL_UP_QUEST_HANDOFF_KEY).toBe('tiq-level-up-quest-handoff-v1')
    expect(handoff.version).toBe(1)
    expect(handoff.questState).toBe('pending')
    expect(handoff.questMessage).toBe('Quest XP queued.')
    expect(handoff.nextRepHref).toBe('/level-up/relentless-competitor-4-0?card=serve-body-pressure#level-up-flow')
    expect(handoff.questBuilderHref).toBe('/level-up/relentless-competitor-4-0?questCard=serve-wide-open-court#quest-builder')
  })

  it('counts distinct consecutive tennis days through today or yesterday', () => {
    const now = new Date(2026, 7, 10, 12)

    expect(buildLevelUpTennisStreak([
      new Date(2026, 7, 10, 9).toISOString(),
      new Date(2026, 7, 10, 11).toISOString(),
      new Date(2026, 7, 9, 17).toISOString(),
      new Date(2026, 7, 8, 8).toISOString(),
    ], now)).toBe(3)

    expect(buildLevelUpTennisStreak([
      new Date(2026, 7, 9, 17).toISOString(),
      new Date(2026, 7, 8, 8).toISOString(),
    ], now)).toBe(2)

    expect(buildLevelUpTennisStreak([new Date(2026, 7, 7, 8).toISOString()], now)).toBe(0)
  })

  it('rejects malformed storage and keeps only safe Level Up destinations', () => {
    expect(parseLevelUpQuestHandoff('{bad json')).toBeNull()

    const handoff = buildHandoff()
    const parsed = parseLevelUpQuestHandoff(JSON.stringify({
      ...handoff,
      nextRepHref: 'https://example.com/leave',
      questBuilderHref: '/admin',
    }))

    expect(parsed?.nextRepHref).toBe('/level-up/relentless-competitor-4-0?focus=serve-plus-one#level-up-flow')
    expect(parsed?.questBuilderHref).toBe('/level-up/relentless-competitor-4-0#quest-builder')
  })

  it('keeps the newest local or synced proof and reflects quest credit state', () => {
    const older = buildHandoff('2026-08-09T15:30:00.000Z')
    const newer = buildHandoff('2026-08-10T15:30:00.000Z')

    expect(chooseLatestLevelUpQuestHandoff(older, newer)?.sessionId).toBe(newer.sessionId)
    expect(updateLevelUpQuestHandoffMessage(newer, 'Quest XP recorded for Serve Week.')).toMatchObject({
      questState: 'credited',
      questMessage: 'Quest XP recorded for Serve Week.',
    })
  })
})
