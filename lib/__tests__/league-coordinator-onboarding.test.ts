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
    expect(source).toContain('Loading League Office...')
    expect(source).toContain('const isFirstLeagueSetup = registryLoaded && access.canUseLeagueTools && !hasSavedLeague')
  })

  it('guides a new coordinator through one setup path', () => {
    expect(source).toContain('Create your first league.')
    expect(source).toContain('aria-label="First league setup steps"')
    expect(source).toContain("title: 'Name the league'")
    expect(source).toContain("title: 'Add competitors'")
    expect(source).toContain("title: 'Save and continue'")
    expect(source).toContain("isFirstLeagueSetup ? 'Start setup' : nextLeagueOpsStep.cta")
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
    expect(source).toContain('Need help?')
    expect(source).toContain('Review League Office setup steps.')
    expect(source).toContain('{coordinatorStartCards.length} steps')
  })
})
