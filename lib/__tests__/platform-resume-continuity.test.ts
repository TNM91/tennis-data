import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const route = read('app/api/resume/overview/route.ts')
const hook = read('app/components/use-platform-resume.ts')
const header = read('app/components/site-header.tsx')
const captain = read('app/captain/page.tsx')
const lineupBuilder = read('app/captain/lineup-builder/page.tsx')

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
    expect(hook).toContain('PLATFORM_RESUME_UPDATED_EVENT')
    expect(hook).toContain("window.addEventListener('storage'")
    expect(hook).toContain("window.addEventListener('pageshow'")
    expect(hook).toContain("document.addEventListener('visibilitychange'")
  })

  it('can keep resume sync out of the mobile header critical path', () => {
    expect(hook).toContain('enabled = true')
    expect(hook).toContain('if (!enabled) return')
    expect(hook).toContain('if (!enabled || !accessToken || !userId)')
    expect(header).toContain('enabled: !isMobile && authenticated && authResolved')
  })

  it('keeps one-tap Continue compact and puts alternatives in the account menu', () => {
    expect(header).toContain('getHeaderResumeShortcutLabel({')
    expect(header).toContain('data-site-resume-shortcut="true"')
    expect(header).toContain('{authenticated && resumePrimary && !isMobile ? (')
    expect(header).toContain('data-header-upload-action="true"')
    expect(header).toContain('Pick up where you left off')
    expect(header).toContain('resumeItems.slice(0, 3)')
    expect(header).toContain('resumeItems.slice(0, 2)')
    expect(header).toContain("if (item.id === 'captain') return access.canUseCaptainWorkflow")
    expect(header).toContain("if (item.id === 'coach') return access.canUseCoachWorkflow")
    expect(header).toContain("if (item.id === 'league') return access.canUseLeagueTools")
  })

  it('promotes real unfinished work without adding another portal surface', () => {
    expect(header).toContain('getHeaderResumeShortcutLabel({')
    expect(header).toContain('status: resumePrimary.status')
    expect(header).toContain('resumePrimary.actionLabel')
    expect(header).toContain("resumePrimary?.status === 'unfinished' ? 'Needs attention'")
    expect(hook).toContain('tenaceiq-team-room-draft:')
    expect(hook).toContain('buildPlatformResumeHandoff(previousCandidates, nextCandidates)')
    expect(hook).toContain('getPlatformResumeCompletionMessage(nextHandoff.completedActionLabel)')
    expect(hook).toContain('applyPlatformResumeHandoff(')
    expect(header).toContain("resumePrimary?.handoff ? 'Next up'")
    expect(header).toContain('role="status"')
    expect(header).toContain('aria-live="polite"')
    expect(header).toContain('Next: ${resumePrimary.actionLabel}.')
  })

  it('lets users defer a shortcut without clearing the underlying work', () => {
    expect(hook).toContain('filterPlatformResumeCandidates(')
    expect(hook).toContain("suppressItem(candidate, 'later')")
    expect(hook).toContain("suppressItem(candidate, 'hidden')")
    expect(header).toContain('Move ${itemLabel} to Later')
    expect(header).toContain('Hide ${itemLabel}')
    expect(header).toContain('undoResumeAction')
  })

  it('carries Captain lineup and reply state between devices', () => {
    expect(captain).toContain('pendingResponseCount: workspaceState.pendingResponseCount')
    expect(captain).toContain('lineupCount: workspaceState.lineupCount')
    expect(captain).toContain('weekStatus,')
    expect(lineupBuilder).toContain('const lineupCount = teamSlots.filter')
    expect(lineupBuilder).toContain('weekStatus,')
  })
})
