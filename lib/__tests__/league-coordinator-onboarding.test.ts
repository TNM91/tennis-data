import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'),
  'utf8',
)

describe('League Coordinator first-use path', () => {
  it('waits for the league registry before choosing first-use or returning copy', () => {
    expect(source).toContain('const [registryLoaded, setRegistryLoaded] = useState(false)')
    expect(source).toContain('setRegistryLoaded(true)')
    expect(source).toContain("title: 'Getting your leagues'")
    expect(source).toContain("const leagueHomeName = coordinatorResumeLeague?.leagueName || latestRecord?.leagueName || (registryLoaded ? 'Create your first league' : 'Loading leagues')")
    expect(source).toContain('const isFirstLeagueSetup = registryLoaded && canUseLeagueTools && !hasSavedLeague')
  })

  it('guides a new coordinator through one setup path', () => {
    expect(source).toContain('<LeagueOfficeHome')
    expect(source).toContain('const leagueHomeProgressBase = [')
    expect(source).toContain("{ label: 'Setup', complete: hasSavedLeague }")
    expect(source).toContain("{ label: latestRecord?.weeklySettings.enabled ? 'Roster' : 'Players', complete: activeParticipantCount > 0 }")
    expect(source).toContain("title: sharedSchedulerNextMove.label")
    expect(source).toContain('open={setupOpen || !!editingId || isFirstLeagueSetup}')
  })

  it('keeps advanced setup and active-season tools out of the first-use path', () => {
    expect(source).toContain('More season options')
    expect(source).toContain('Scheduling, scoring, visibility, and season rules.')
    expect(source).toContain('id="league-registry"')
    expect(source.match(/\{hasSavedLeague \? \(/g)?.length).toBeGreaterThanOrEqual(2)
    expect(source).toContain('{!isFirstLeagueSetup ? <div style={setupFocusPanelStyle}')
  })

  it('turns completed onboarding into a returning coordinator home', () => {
    expect(source).toContain('const displayedLeagueHomeAction = coordinatorContinueAction || leagueHomeAction')
    expect(source).toContain('leagueName={leagueHomeName}')
    expect(source).toContain('progress={leagueHomeProgress}')
    expect(source).toContain('pulse={leagueHomePulse}')
    expect(source).toContain('function dismissLeagueSetupConfirmation()')
    expect(source).toContain('onClick={dismissLeagueSetupConfirmation}')
    expect(source).toContain("setStatus('')")
    expect(source).toContain('Done')
  })

  it('celebrates the first saved season without repeating the launch moment on later edits', () => {
    expect(source).toContain('const [lastSavedFirstLeague, setLastSavedFirstLeague] = useState(false)')
    expect(source).toContain('const firstLeagueLaunch = !editingId && records.length === 0')
    expect(source).toContain('League trophy earned')
    expect(source).toContain('First season launched')
    expect(source).toContain('setLastSavedFirstLeague(false)')
  })
})
