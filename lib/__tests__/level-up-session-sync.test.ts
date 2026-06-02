import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const playerApiSource = readFileSync(join(process.cwd(), 'app/api/player/level-up-sessions/route.ts'), 'utf8')
const coachApiSource = readFileSync(join(process.cwd(), 'app/api/coach/level-up-sessions/route.ts'), 'utf8')
const coachPageSource = readFileSync(join(process.cwd(), 'app/coach/page.tsx'), 'utf8')
const workbenchSource = readFileSync(join(process.cwd(), 'app/player-development/_components/player-live-workbench.tsx'), 'utf8')
const portalSource = readFileSync(join(process.cwd(), 'app/player-development/_components/level-up-portal.tsx'), 'utf8')
const authSource = readFileSync(join(process.cwd(), 'lib/player-api-auth.ts'), 'utf8')

describe('Level Up session sync', () => {
  it('keeps coach-invited access separate from Player+ self-guided access', () => {
    expect(authSource).toContain('getSignedInPlayerApiAuth')
    expect(playerApiSource).toContain("accessMode === 'coach_invited'")
    expect(playerApiSource).toContain("accessMode === 'player_plus'")
    expect(playerApiSource).toContain('loadPlayerAccess')
    expect(playerApiSource).toContain('Connect with a coach invite before syncing coach-visible Level Up work.')
    expect(playerApiSource).toContain('Player+ is required to sync self-guided Level Up history across devices.')
  })

  it('persists Level Up work for players and exposes shared logs to coaches', () => {
    expect(existsSync(join(process.cwd(), 'supabase/migrations/20260530000100_create_level_up_sessions.sql'))).toBe(true)
    expect(playerApiSource).toContain(".from('level_up_sessions')")
    expect(playerApiSource).toContain('buildPlayerAssignmentCompletion')
    expect(playerApiSource).toContain('payload.assignment_id')
    expect(workbenchSource).toContain('assignmentId')
    expect(workbenchSource).toContain('studentLinkId')
    expect(coachApiSource).toContain(".from('level_up_sessions')")
    expect(coachApiSource).toContain(".eq('shared_with_coach', true)")
    expect(workbenchSource).toContain('/api/player/level-up-sessions')
    expect(workbenchSource).toContain('Synced. Your linked coach can use this for the next lesson.')
    expect(workbenchSource).toContain('Free preview saved locally.')
  })

  it('syncs portal proof logs through coach invite, Player+, or local fallback', () => {
    expect(portalSource).toContain('function useLevelUpCompletions(')
    expect(portalSource).toContain('assignmentByCardId: Map<string, LevelUpAssignment>')
    expect(portalSource).toContain('supabase.auth.getSession')
    expect(portalSource).toContain('/api/player/level-up-sessions')
    expect(portalSource).toContain('/api/player/coach-assignments')
    expect(portalSource).toContain("accessMode: 'coach_invited'")
    expect(portalSource).toContain("accessMode: 'player_plus'")
    expect(portalSource).toContain('assignmentId: assignmentByCardId.get(cardId)?.id')
    expect(portalSource).toContain('Saved locally. Sign in from a coach invite or Player+ to sync proof history.')
    expect(portalSource).toContain('Synced. Your linked coach can use this for the next lesson.')
    expect(portalSource).toContain('Synced to your Level Up history.')
    expect(portalSource).toContain('remoteSessionToCompletion')
    expect(portalSource).toContain('mergeCompletions')
  })

  it('surfaces Level Up proof on coach assignment review cards', () => {
    expect(coachPageSource).toContain('buildAssignmentProofMap(levelUpSessions)')
    expect(coachPageSource).toContain('assignmentProofById.get(assignment.id)')
    expect(coachPageSource).toContain('Level Up proof received')
    expect(coachPageSource).toContain('buildLevelUpProofReviewDraft')
    expect(coachPageSource).toContain('setReviewNote(proofReviewDraft?.note')
    expect(coachPageSource).toContain('setReviewNextFocus(proofReviewDraft?.nextFocus')
  })

  it('lets Coach Hub assign exact Level Up cards into the player portal', () => {
    expect(coachPageSource).toContain('assignmentLevelUpCardId')
    expect(coachPageSource).toContain('Assign exact Level Up card')
    expect(coachPageSource).toContain('buildCoachLevelUpAssignmentCards')
    expect(coachPageSource).toContain('cardId: levelUpCard.id')
    expect(coachPageSource).toContain('moduleId: levelUpModule?.id')
    expect(coachPageSource).toContain('portalHref: `/player-development/${')
  })
})
