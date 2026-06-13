import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const coachSource = readFileSync(join(process.cwd(), 'app/coach/page.tsx'), 'utf8')
const captainSource = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')

describe('Level Up handoff surfaces', () => {
  it('turns Level Up pack links into Coach Hub assignment context', () => {
    expect(coachSource).toContain('useSearchParams')
    expect(coachSource).toContain('COACH_LEVEL_UP_HANDOFF_PACKS')
    expect(coachSource).toContain("searchParams.get('levelUpPack')")
    expect(coachSource).toContain('Level Up handoff')
    expect(coachSource).toContain('Coach assignment bridge')
    expect(coachSource).toContain('Load into assignment form')
    expect(coachSource).toContain('buildCoachLevelUpHandoffPack')
    expect(coachSource).toContain('setAssignmentTitle(pack.assignmentTitle)')
    expect(coachSource).toContain('setAssignmentLevelUpCardId')
    expect(coachSource).toContain('doubles-readiness')
    expect(coachSource).toContain('match-day-routine')
  })

  it('turns Level Up challenge links into Captain team challenge context', () => {
    expect(captainSource).toContain('useSearchParams')
    expect(captainSource).toContain('CAPTAIN_LEVEL_UP_CHALLENGES')
    expect(captainSource).toContain("searchParams.get('levelUpChallenge')")
    expect(captainSource).toContain('Level Up team challenge')
    expect(captainSource).toContain('Team challenge mode')
    expect(captainSource).toContain('Aggregate completion only')
    expect(captainSource).toContain('Private player proof and notes stay with each player.')
    expect(captainSource).toContain('appendLevelUpChallengeHref')
    expect(captainSource).toContain('Plan practice')
    expect(captainSource).toContain('Add to weekly brief')
  })
})
