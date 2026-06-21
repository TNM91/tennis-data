import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const suitePanelPaths = [
  'app/components/player-suite-panel.tsx',
  'app/components/captain-suite-panel.tsx',
  'app/components/league-suite-panel.tsx',
]

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('suite panel navigation deduplication', () => {
  it('keeps suite panels contextual instead of adding a second subnav', () => {
    for (const path of suitePanelPaths) {
      const file = source(path)

      expect(file).not.toContain("import Link from 'next/link'")
      expect(file).not.toContain('nextActionStyle')
      expect(file).not.toContain('nextLinkStyle')
      expect(file).not.toContain('Suggested next move')
      expect(file).not.toContain('You lane')
      expect(file).not.toContain('League lane')
    }
  })

  it('keeps the tournament builder under the shared portal instead of embedding league subnav', () => {
    const file = source('app/components/tournament-builder-workspace.tsx')

    expect(file).not.toContain('CoordinatorSubnav')
    expect(file).not.toContain('League command path')
  })

  it('removes retired Captain and Coordinator subnav components', () => {
    const siteNavigation = source('lib/site-navigation.ts')

    expect(siteNavigation).not.toContain('CAPTAIN_NAV_ITEMS')
    expect(siteNavigation).not.toContain('COORDINATOR_NAV_ITEMS')
    expect(siteNavigation).not.toContain('COMPETE_NAV_ITEMS')
  })

  it('keeps the Captain hub from presenting a second tools menu', () => {
    const captain = source('app/captain/page.tsx')

    expect(captain).toContain('Team Hub actions')
    expect(captain).toContain('In-tool actions')
    expect(captain).toContain('roster, schedule, and scorecard uploads can keep Team Hub current.')
    expect(captain).not.toContain('Team workspace actions')
    expect(captain).not.toContain('In-workspace actions')
    expect(captain).not.toContain('keep this workspace current')
    expect(captain).not.toContain('Team workspace shortcuts')
    expect(captain).not.toContain('More captain tools')
    expect(captain).not.toContain('Open tools')
  })

  it('routes player-suite data improvement through guided Data Assist', () => {
    const playerSuite = source('app/components/player-suite-panel.tsx')

    expect(playerSuite).toContain("const dataAssistPlayerSuiteHref = '/data-assist?intent=upload-source&context=Player%20tools'")
    expect(playerSuite).toContain("label: 'Fix tennis info'")
    expect(playerSuite).toContain("title: 'Fix tennis info'")
    expect(playerSuite).toContain('href: dataAssistPlayerSuiteHref')
  })

  it('uses tool and hub language for contextual panel labels', () => {
    expect(source('app/components/player-suite-panel.tsx')).toContain('aria-label="Player tool context"')
    expect(source('app/components/captain-suite-panel.tsx')).toContain('aria-label="Team Hub context"')
    expect(source('app/components/league-suite-panel.tsx')).toContain('aria-label="League Office context"')

    for (const path of suitePanelPaths) {
      expect(source(path)).not.toContain('suite context')
    }
  })

  it('keeps the persistent portal from replacing page-level headings', () => {
    const portal = source('app/components/portal-tool-bar.tsx')
    const myLab = source('app/mylab/page.tsx')
    const captain = source('app/captain/page.tsx')
    const league = source('app/components/league-coordinator-workspace.tsx')

    expect(portal).toContain('aria-label="TenAceIQ platform navigation"')
    expect(portal).toContain('aria-label="Choose a TenAceIQ tool"')
    expect(portal).toContain('Plan practice')
    expect(portal).toContain("const dataAssistPortalHref = '/data-assist?intent=upload-source&context=Portal'")
    expect(portal).toContain('href: dataAssistPortalHref')
    expect(portal).toContain('const publicVisitor = !authenticated')
    expect(portal).toContain('compact={publicVisitor}')
    expect(portal).toContain('publicPortalTitleStyle')
    expect(portal).not.toContain("if (!authenticated && pathname !== '/') return null")
    expect(portal).not.toContain('if (!authenticated) return null')
    expect(portal).not.toContain('<h1 style={portalTitleStyle}>')
    expect(myLab).toContain('<h1 style={sectionTitleStyle}>{welcomeLine}</h1>')
    expect(captain).toContain('<h1 style={scopeTitleStyle}>Choose the week.</h1>')
    expect(league).toContain('<h1 style={leagueOpsTitleStyle}>')
  })
})
