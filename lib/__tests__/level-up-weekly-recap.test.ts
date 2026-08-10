import { describe, expect, it } from 'vitest'
import { buildWeeklyLevelUpRecap, type WeeklyLevelUpSessionRead } from '../level-up/weekly-recap'

const identitySlug = 'relentless-competitor-4-0'

function session(
  id: string,
  focusId: string,
  focusTitle: string,
  drillTitle: string,
  rating: number,
  completedAt: Date,
): WeeklyLevelUpSessionRead {
  return {
    id,
    identitySlug,
    focusId,
    focusTitle,
    drillTitle,
    rating,
    completedAt: completedAt.toISOString(),
  }
}

describe('weekly Level Up recap', () => {
  const now = new Date(2026, 7, 10, 12)
  const focuses = [
    { id: 'serve', title: 'Serve Development' },
    { id: 'movement', title: 'Movement Development' },
    { id: 'doubles', title: 'Doubles Development' },
  ]

  it('compares the last seven days, identifies the strongest focus, and builds three next reps', () => {
    const recap = buildWeeklyLevelUpRecap({
      identitySlug,
      now,
      focuses,
      sessions: [
        session('serve-1', 'serve', 'Serve Development', 'Wide serve + 1', 5, new Date(2026, 7, 10, 9)),
        session('serve-2', 'serve', 'Serve Development', 'Body serve pressure', 4, new Date(2026, 7, 9, 17)),
        session('move-1', 'movement', 'Movement Development', 'Split-step rhythm', 3, new Date(2026, 7, 8, 8)),
        session('prior-1', 'serve', 'Serve Development', 'T serve target', 4, new Date(2026, 7, 3, 8)),
      ],
    })

    expect(recap).toMatchObject({
      proofCount: 3,
      proofTrend: 'up',
      proofTrendLabel: '+2 vs prior 7 days',
      activeDays: 3,
      activeDayTrend: 'up',
      tennisStreakDays: 3,
      averageRating: 4,
      strongestFocus: 'Serve',
      strongestFocusRead: '4.5/5 across 2 proofs',
    })
    expect(recap.nextReps).toHaveLength(3)
    expect(recap.nextReps.map((rep) => rep.kind)).toEqual(['repeat', 'repair', 'balance'])
    expect(recap.nextReps[0]).toMatchObject({
      title: 'Repeat Wide serve + 1',
      href: '/level-up/relentless-competitor-4-0?focus=serve#level-up-flow',
    })
    expect(recap.nextReps[1].title).toBe('Clean up Split-step rhythm')
    expect(recap.nextReps[2].title).toBe('Doubles proof')
  })

  it('reports downward direction without hiding existing tennis streak', () => {
    const recap = buildWeeklyLevelUpRecap({
      identitySlug,
      now,
      focuses,
      sessions: [
        session('today', 'serve', 'Serve', 'Serve target', 4, new Date(2026, 7, 10, 9)),
        session('prior-1', 'serve', 'Serve', 'Serve target', 4, new Date(2026, 7, 3, 9)),
        session('prior-2', 'movement', 'Movement', 'Split step', 4, new Date(2026, 7, 2, 9)),
        session('prior-3', 'doubles', 'Doubles', 'First volley', 4, new Date(2026, 7, 1, 9)),
      ],
    })

    expect(recap.proofTrend).toBe('down')
    expect(recap.proofTrendLabel).toBe('2 fewer than prior 7 days')
    expect(recap.activeDayTrend).toBe('down')
    expect(recap.activeDayTrendLabel).toBe('Down 2 active days')
    expect(recap.tennisStreakDays).toBe(1)
  })

  it('turns an empty week into a short three-rep starter plan', () => {
    const recap = buildWeeklyLevelUpRecap({ identitySlug, now, focuses, sessions: [] })

    expect(recap).toMatchObject({
      proofCount: 0,
      proofTrend: 'steady',
      proofTrendLabel: 'First proof starts the week',
      activeDays: 0,
      tennisStreakDays: 0,
      strongestFocus: 'First proof decides',
    })
    expect(recap.summary).toBe('No proof in the last seven days. Start with one short, scored rep.')
    expect(recap.nextReps).toHaveLength(3)
    expect(recap.nextReps.map((rep) => rep.label)).toEqual(['Start here', 'Add proof', 'Match transfer'])
  })
})
