import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const route = read('app/api/resume/overview/route.ts')
const hook = read('app/components/use-platform-resume.ts')
const header = read('app/components/site-header.tsx')

describe('platform-wide pick up continuity', () => {
  it('authenticates once and loads all lane memories in parallel', () => {
    expect(route).toContain('getResumeOverviewAuth(request)')
    expect(route).toContain('Promise.all(')
    for (const table of [
      'captain_workspace_preferences',
      'coach_workspace_preferences',
      'player_improve_workspace_preferences',
      'compete_workspace_preferences',
      'explore_workspace_preferences',
      'league_coordinator_workspace_preferences',
    ]) {
      expect(route).toContain(table)
    }
  })

  it('merges device and cloud history for the signed-in account', () => {
    expect(hook).toContain('readCaptainResumeState(userId)')
    expect(hook).toContain("fetch('/api/resume/overview'")
    expect(hook).toContain('mergePlatformResumeCandidates(localCandidates, cloudCandidates)')
  })

  it('keeps one-tap Continue compact and puts alternatives in the account menu', () => {
    expect(header).toContain('Continue ${resumePrimary.lane}')
    expect(header).toContain('Pick up where you left off')
    expect(header).toContain('resumeItems.slice(0, 3)')
    expect(header).toContain('resumeItems.slice(0, 2)')
    expect(header).toContain("if (item.id === 'captain') return access.canUseCaptainWorkflow")
    expect(header).toContain("if (item.id === 'coach') return access.canUseCoachWorkflow")
    expect(header).toContain("if (item.id === 'league') return access.canUseLeagueTools")
  })
})
