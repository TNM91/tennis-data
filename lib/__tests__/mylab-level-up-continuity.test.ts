import { describe, expect, it } from 'vitest'
import {
  buildMyLabWeeklyImprovementPlan,
  mergeMyLabLevelUpProofRecords,
} from '@/lib/level-up/mylab-proof-continuity'
import type { LevelUpCompletion } from '@/lib/level-up/level-up-types'
import type { LevelUpSession } from '@/lib/level-up-sessions'

function remoteSession(overrides: Partial<LevelUpSession> = {}): LevelUpSession {
  return {
    id: 'session-1',
    playerUserId: 'player-1',
    coachUserId: null,
    studentLinkId: null,
    assignmentId: null,
    identitySlug: 'smart-attacker-4-0-to-4-5',
    focusId: 'net-close',
    focusTitle: 'Forward Closing',
    workType: 'court',
    context: 'alone',
    drillTitle: 'Short-Ball Close + Split',
    rating: 5,
    feeling: 'ready',
    accessMode: 'player_plus',
    note: 'Closed through the ball and split on time.',
    elapsedSeconds: 620,
    sharedWithCoach: false,
    sessionJson: { cardId: 'short-ball-close-split' },
    starterRead: {
      starterRep: 'Close through the short ball.',
      starterProofCue: 'Split before the reply.',
      starterLeakWatch: 'Do not stop after the approach.',
      starterSmartNext: 'Add the first volley under pressure.',
    },
    completedAt: '2026-08-15T20:00:00.000Z',
    createdAt: '2026-08-15T20:00:00.000Z',
    updatedAt: '2026-08-15T20:00:00.000Z',
    ...overrides,
  }
}

describe('My Lab Level Up proof continuity', () => {
  it('turns an account session into the newest actionable My Lab proof', () => {
    const [proof] = mergeMyLabLevelUpProofRecords([], [remoteSession()])

    expect(proof).toMatchObject({
      cardId: 'short-ball-close-split',
      cardTitle: 'Short-Ball Close + Split',
      source: 'account',
      rating: 5,
      nextCue: 'Add the first volley under pressure.',
    })
  })

  it('deduplicates device and account copies while keeping the account cue', () => {
    const local: LevelUpCompletion[] = [{
      id: 'session-1',
      playerId: 'local-player',
      cardId: 'short-ball-close-split',
      completedAt: '2026-08-15T20:00:00.000Z',
      proofRating: 4,
      note: 'Saved first on the phone.',
      durationMinutes: 10,
    }]

    const [proof] = mergeMyLabLevelUpProofRecords(local, [remoteSession()])

    expect(proof.source).toBe('account-and-device')
    expect(proof.rating).toBe(5)
    expect(proof.note).toContain('Closed through the ball')
    expect(proof.nextCue).toBe('Add the first volley under pressure.')
  })

  it('recovers legacy account sessions by matching the drill title', () => {
    const [proof] = mergeMyLabLevelUpProofRecords([], [remoteSession({ sessionJson: {} })])

    expect(proof.cardId).toBe('short-ball-close-split')
    expect(proof.identitySlug).toBe('smart-attacker-4-0-to-4-5')
  })

  it('repeats a weak proof cleaner and counts only the current week', () => {
    const proofs = mergeMyLabLevelUpProofRecords([], [
      remoteSession({ id: 'weak-now', rating: 2, completedAt: '2026-08-15T20:00:00.000Z' }),
      remoteSession({ id: 'old-proof', rating: 4, completedAt: '2026-08-02T20:00:00.000Z' }),
    ])
    const plan = buildMyLabWeeklyImprovementPlan(proofs, new Date('2026-08-15T22:00:00.000Z'))

    expect(plan).toMatchObject({
      mode: 'repeat',
      modeLabel: 'Repeat cleaner',
      completedSessions: 1,
      targetSessions: 4,
      progressPercent: 25,
    })
    expect(plan.why).toContain('scored 2/5')
    expect(plan.nextAction).toContain('Remove')
  })

  it('adds pressure after a strong proof and reports the recent trend', () => {
    const proofs = mergeMyLabLevelUpProofRecords([], [
      remoteSession({ id: 'strong-now', rating: 5, completedAt: '2026-08-15T20:00:00.000Z' }),
      remoteSession({ id: 'strong-prior', rating: 4, completedAt: '2026-08-14T20:00:00.000Z' }),
    ])
    const plan = buildMyLabWeeklyImprovementPlan(proofs, new Date('2026-08-15T22:00:00.000Z'))

    expect(plan).toMatchObject({
      mode: 'pressure',
      modeLabel: 'Add pressure',
      completedSessions: 2,
      trendLabel: 'Improving +1',
    })
    expect(plan.why).toContain('scored 5/5')
    expect(plan.coachSummary).toContain('Next:')
  })
})
