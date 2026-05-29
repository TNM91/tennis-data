import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('League hub action alignment', () => {
  it('keeps the League hub and footer aligned with the portal action dock', () => {
    const compete = readFileSync(join(process.cwd(), 'app/compete/page.tsx'), 'utf8')
    const competeLayout = readFileSync(join(process.cwd(), 'app/compete/layout.tsx'), 'utf8')
    const competeFrame = readFileSync(join(process.cwd(), 'app/compete/_components/compete-page-frame.tsx'), 'utf8')
    const footerNav = readFileSync(join(process.cwd(), 'lib/site-navigation.ts'), 'utf8')

    expect(competeLayout).toContain("title: 'League Office'")
    expect(competeLayout).toContain('index: false')
    expect(competeFrame).toContain("value: 'League Office'")
    expect(competeFrame).toContain('<SiteShell active="/leagues">')
    expect(compete).toContain('eyebrow="League Office"')
    expect(compete).toContain('Shared calendar')
    expect(compete).toContain('Build tournament')
    expect(compete).toContain('Team book')
    expect(compete).toContain('Player book')
    expect(compete).toContain('Shared calendar, tournaments, team results, and player results stay in one League Office lane.')
    expect(compete).not.toContain('title="My leagues"')

    expect(footerNav).toContain("{ href: '/league-coordinator/tournaments', label: 'Build tournament' }")
    expect(footerNav).not.toContain("{ href: '/compete/leagues', label: 'My leagues' }")
    expect(footerNav).not.toContain("label: 'Tournament builder'")
  })

  it('keeps the contextual League suite panel from reviving the old My leagues submenu slot', () => {
    const suitePanel = readFileSync(join(process.cwd(), 'app/components/league-suite-panel.tsx'), 'utf8')

    expect(suitePanel).toContain("type LeagueSuiteStep = 'shared-calendar' | 'team-book' | 'player-book' | 'team-results' | 'player-results'")
    expect(suitePanel).not.toContain("'my-leagues'")
    expect(suitePanel).not.toContain("title: 'My leagues'")
    expect(suitePanel).not.toContain("href: '/compete/leagues'")
  })

  it('keeps the deeper League directory supportive instead of acting like another command hub', () => {
    const leagueDirectory = readFileSync(join(process.cwd(), 'app/compete/leagues/page.tsx'), 'utf8')

    expect(leagueDirectory).toContain('eyebrow="League Office directory"')
    expect(leagueDirectory).toContain('title="Open the right league room."')
    expect(leagueDirectory).toContain('title="League Office"')
    expect(leagueDirectory).toContain('title="Browse leagues"')
    expect(leagueDirectory).toContain('title="Improve league data"')
    expect(leagueDirectory).toContain('title="Team week"')
    expect(leagueDirectory).toContain('Open League Office')
    expect(leagueDirectory).not.toContain('eyebrow="My Leagues"')
    expect(leagueDirectory).not.toContain('title="TIQ League Coordinator"')
    expect(leagueDirectory).not.toContain('title="Captain Command Center"')
    expect(leagueDirectory).not.toContain('Pick the package that solves the friction you have right now.')
  })

  it('keeps old My leagues labels out of supporting surfaces', () => {
    const homepage = readFileSync(join(process.cwd(), 'app/components/preview-homepage.tsx'), 'utf8')
    const myLab = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

    expect(homepage).toContain("{ href: '/compete/leagues', label: 'League directory' }")
    expect(myLab).toContain('League directory')
    expect(homepage).not.toContain("label: 'My leagues'")
    expect(myLab).not.toContain('My leagues')
  })
})
