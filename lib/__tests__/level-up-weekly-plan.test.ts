import { describe, expect, it } from 'vitest'
import {
  buildWeeklyLevelUpCoachResponse,
  buildWeeklyLevelUpPlan,
  completeWeeklyLevelUpPlanFocus,
  getWeeklyLevelUpPlanProgress,
  getWeeklyLevelUpPlanReps,
  getWeeklyLevelUpPlanStorageKey,
  getWeeklyLevelUpPlanWeekStart,
  parseWeeklyLevelUpPlan,
  setWeeklyLevelUpPlanShared,
  toggleWeeklyLevelUpPlanRep,
} from '../level-up/weekly-plan'
import type { WeeklyLevelUpRecap } from '../level-up/weekly-recap'

const recap: WeeklyLevelUpRecap = {
  proofCount: 2,
  proofTrend: 'up',
  proofTrendLabel: '+2 vs prior 7 days',
  activeDays: 2,
  activeDayTrend: 'up',
  activeDayTrendLabel: 'Up 2 active days',
  tennisStreakDays: 2,
  averageRating: 4,
  strongestFocus: 'Serve',
  strongestFocusRead: '4.5/5 across 2 proofs',
  summary: 'Two clean proofs this week.',
  nextReps: ['serve', 'movement', 'doubles'].map((focusId, index) => ({
    id: `rep-${index + 1}`,
    kind: index === 0 ? 'repeat' as const : index === 1 ? 'repair' as const : 'balance' as const,
    focusId,
    identitySlug: 'competitor',
    label: index === 0 ? 'Keep the win' : 'Add proof',
    title: `${focusId} rep`,
    detail: 'Bank one scored rep.',
    href: `/level-up/competitor?focus=${focusId}#level-up-flow`,
  })),
}

describe('saved weekly Level Up plan', () => {
  const now = new Date(2026, 7, 12, 12)

  it('snapshots three recommendations into a versioned Monday week', () => {
    const plan = buildWeeklyLevelUpPlan(recap, 'competitor', now)
    expect(plan).toMatchObject({
      version: 1,
      weekStart: '2026-08-10',
      sharedWithCoach: false,
    })
    expect(plan?.id).toMatch(/^level-up-week-2026-08-10-competitor-/)
    expect(plan?.reps).toHaveLength(3)
    expect(getWeeklyLevelUpPlanWeekStart(now)).toBe('2026-08-10')
    expect(getWeeklyLevelUpPlanStorageKey('competitor', '2026-08-10', 'user-1')).toContain('v1:user-1:competitor')
  })

  it('tracks manual and proof-backed completion without mutating the input plan', () => {
    const plan = buildWeeklyLevelUpPlan(recap, 'competitor', now)!
    const manuallyCompleted = toggleWeeklyLevelUpPlanRep(plan, 'rep-1', new Date(2026, 7, 12, 13))
    const proofCompleted = completeWeeklyLevelUpPlanFocus(
      manuallyCompleted,
      'competitor',
      'movement',
      new Date(2026, 7, 12, 14).toISOString(),
    )

    expect(plan.reps.every((rep) => rep.completedAt === null)).toBe(true)
    expect(getWeeklyLevelUpPlanProgress(proofCompleted)).toMatchObject({ completed: 2, total: 3, percent: 67 })
    expect(getWeeklyLevelUpPlanProgress(proofCompleted).nextRep?.focusId).toBe('doubles')
  })

  it('keeps coach sharing explicit and validates stored plans', () => {
    const plan = buildWeeklyLevelUpPlan(recap, 'competitor', now)!
    const shared = setWeeklyLevelUpPlanShared(plan, true, { coachUserId: 'coach-1', studentLinkId: 'link-1' }, now)
    const parsed = parseWeeklyLevelUpPlan(JSON.stringify(shared))

    expect(parsed).toMatchObject({ sharedWithCoach: true, coachUserId: 'coach-1', studentLinkId: 'link-1' })
    expect(setWeeklyLevelUpPlanShared(shared, false, {}, now)).toMatchObject({
      sharedWithCoach: false,
      coachUserId: null,
      studentLinkId: null,
    })
    expect(parseWeeklyLevelUpPlan('{"version":99}')).toBeNull()
  })

  it('layers a coach adjustment or replacement over the saved plan and credits replacement proof', () => {
    const plan = buildWeeklyLevelUpPlan(recap, 'competitor', now)!
    const replacementRep = {
      ...recap.nextReps[0],
      focusId: 'coach-serve',
      label: 'Coach pick',
      title: 'Coach serve target rep',
      href: '/level-up/competitor?focus=coach-serve&card=serve-target#level-up-flow',
    }
    const coachResponse = buildWeeklyLevelUpCoachResponse(plan, {
      action: 'replaced',
      targetRepId: plan.reps[0].id,
      replacementRep,
      note: 'Use the deuce target before adding pace.',
    }, 'coach-1', now)
    const coachedPlan = { ...plan, coachResponse }
    const effectiveReps = getWeeklyLevelUpPlanReps(coachedPlan)
    const completed = completeWeeklyLevelUpPlanFocus(
      coachedPlan,
      'competitor',
      'coach-serve',
      new Date(2026, 7, 12, 15).toISOString(),
    )

    expect(coachResponse).toMatchObject({ action: 'replaced', coachUserId: 'coach-1' })
    expect(effectiveReps[0]).toMatchObject({ id: plan.reps[0].id, title: 'Coach serve target rep' })
    expect(completed.reps[0].completedAt).not.toBeNull()
    expect(buildWeeklyLevelUpCoachResponse(completed, {
      action: 'replaced',
      targetRepId: completed.reps[0].id,
      replacementRep,
    }, 'coach-1', now)).toBeNull()
  })
})
