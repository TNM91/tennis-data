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
    expect(source).toContain("contextValue={coordinatorResumeLeague?.leagueName || latestRecord?.leagueName || (registryLoaded ? 'No league selected' : 'Loading leagues')}")
    expect(source).toContain('const isFirstLeagueSetup = registryLoaded && access.canUseLeagueTools && !hasSavedLeague')
  })

  it('guides a new coordinator through one setup path', () => {
    expect(source).toContain('roleLabel="League"')
    expect(source).toContain("helpTitle={hasSavedLeague ? 'Need help with League setup?' : 'Set up League in three steps'}")
    expect(source).toContain("title: 'Name the league'")
    expect(source).toContain("title: 'Add competitors'")
    expect(source).toContain("title: 'Save and continue'")
    expect(source).toContain('showSteps={isFirstLeagueSetup}')
    expect(source).toContain('open={setupOpen || !!editingId || isFirstLeagueSetup}')
  })

  it('keeps advanced setup and active-season tools out of the first-use path', () => {
    expect(source).toContain('More season options')
    expect(source).toContain('Scheduling, scoring, visibility, and season rules.')
    expect(source).toContain('id="league-registry"')
    expect(source.match(/\{hasSavedLeague \? \(/g)?.length).toBeGreaterThanOrEqual(2)
    expect(source).toContain('{!isFirstLeagueSetup ? <div style={setupFocusPanelStyle}')
  })

  it('puts completed onboarding behind help for returning coordinators', () => {
    expect(source).toContain('Need help with League setup?')
    expect(source).toContain('steps={firstLeagueSteps}')
    expect(source).toContain('showSteps={isFirstLeagueSetup}')
  })
})
