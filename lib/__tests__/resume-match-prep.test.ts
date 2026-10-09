import { describe, expect, it } from 'vitest'
import { buildResumeMatchPrepHref, latestResumeMatchPrep } from '../resume-match-prep'
import type { LabGoal } from '../my-lab-goal-sync'
const goal = (id: string, updatedAt: string | null, progressStatus: LabGoal['progressStatus'] = 'in-progress'): LabGoal => ({ id, updatedAt, progressStatus, goal: 'Match prep: Alex vs Sam', improveNext: 'Protect the second serve.', notes: '', progressUpdate: '', doingWell: '' })
describe('Resume saved match prep', () => {
  it('restores both singles selections and requests the open courtside view', () => {
    const url = new URL(buildResumeMatchPrepHref('matchup-prep-singles:alex:sam')!, 'https://test.local')
    expect(url.pathname).toBe('/matchup'); expect(url.searchParams.get('playerA')).toBe('alex'); expect(url.searchParams.get('playerB')).toBe('sam'); expect(url.searchParams.get('courtside')).toBe('1'); expect(url.hash).toBe('#courtside-match-prep')
  })
  it('restores all four doubles players in their saved sides', () => {
    const url = new URL(buildResumeMatchPrepHref('matchup-prep-doubles:a:b:c:d')!, 'https://test.local')
    expect(['a1','a2','b1','b2'].map(key => url.searchParams.get(key))).toEqual(['a','b','c','d'])
  })
  it('rejects malformed IDs and repeated players instead of creating a broken shortcut', () => {
    for (const id of ['goal-1','matchup-prep-singles:a','matchup-prep-singles:a:a','matchup-prep-doubles:a:b:c:c','matchup-prep-singles:a:https://bad','matchup-prep-singles:a:b:c']) expect(buildResumeMatchPrepHref(id)).toBeNull()
  })
  it('chooses the latest unfinished complete plan without mutating the notebook', () => {
    const goals = [goal('matchup-prep-singles:a:b','2026-10-01'),goal('matchup-prep-singles:a:c','2026-10-08'),goal('matchup-prep-singles:a:d','2026-10-09','completed')], before = [...goals]
    expect(latestResumeMatchPrep(goals)?.href).toContain('playerB=c'); expect(goals).toEqual(before)
  })
  it('stays absent for empty, completed, or incomplete plans', () => {
    expect(latestResumeMatchPrep([])).toBeNull(); expect(latestResumeMatchPrep([goal('matchup-prep-singles:a:b',null,'completed')])).toBeNull(); expect(latestResumeMatchPrep([{...goal('matchup-prep-singles:a:b',null),improveNext:''}])).toBeNull()
  })
})
