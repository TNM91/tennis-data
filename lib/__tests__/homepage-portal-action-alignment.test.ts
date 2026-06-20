import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('homepage portal action alignment', () => {
  it('keeps Find, Team, League, and Full-Court homepage actions aligned with the persistent portal', () => {
    const homepage = readFileSync(join(process.cwd(), 'app/components/preview-homepage.tsx'), 'utf8')
    const portal = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')

    for (const label of ['Find a player', 'Browse teams', 'Check standings', 'Check rankings']) {
      expect(homepage).toContain(label)
      expect(portal).toContain(label)
    }

    for (const label of ['Who can play', 'Plan practice', 'Build lineup', 'Send plan']) {
      expect(homepage).toContain(label)
      expect(portal).toContain(label)
    }

    for (const label of ['Shared calendar', 'Build tournament', 'Team book', 'Player book']) {
      expect(homepage).toContain(label)
      expect(portal).toContain(label)
    }

    expect(homepage).toContain("queue: ['Find a player', 'Browse teams', 'Check standings', 'Check rankings']")
    expect(homepage).toContain("{ href: '/explore/players', label: 'Find a player' }")
    expect(homepage).not.toContain("label: 'Player directory'")
    expect(homepage).not.toContain("queue: ['Find a player', 'Browse a team', 'Check standings', 'Upload a scorecard']")
    expect(homepage).not.toContain("title: 'Upload scorecard'")
    expect(homepage).toContain("href: '/captain/practice'")
    expect(homepage).toContain("queue: ['Who can play', 'Plan practice', 'Build lineup', 'Send plan']")
    expect(homepage).toContain('Captain includes Player features plus availability')
    expect(homepage).not.toContain('Captain includes Player plus availability')
    expect(homepage).toContain("href: '/league-coordinator/tournaments'")
    expect(homepage).toContain("queue: ['Shared calendar', 'Build tournament', 'Team book', 'Player book']")
    expect(homepage).toContain("queue: ['Build tournament', 'Open Team Hub', 'Track results', 'Open player book']")
    expect(homepage).toContain('Run every tennis job')
    expect(homepage).toContain('Run every tennis job from one place.')
    expect(homepage).toContain('Every tennis job, connected.')
    expect(homepage).toContain('one connected tennis operation')
    expect(homepage).toContain('See player context across every connected tennis job.')
    expect(homepage).toContain('Full-Court unlocks My Lab, Coach Hub, Team Hub, League Office, and unlimited Tournament Desk.')
    expect(homepage).toContain('Unlock Full-Court when one role no longer covers the tennis work.')
    expect(homepage).toContain('as one tennis operation')
    expect(homepage).toContain('Full-Court operation')
    expect(homepage).toContain('Compare Full-Court')
    expect(homepage).toContain('Compare paid plans')
    expect(homepage).not.toContain('full suite')
    expect(homepage).not.toContain('one connected suite')
    expect(homepage).not.toContain('Championship suite')
    expect(homepage).not.toContain('Compare suite')
    expect(homepage).not.toContain('See paid workspaces')
    expect(homepage).not.toContain('Run the full court from one workspace.')
    expect(homepage).not.toContain('The full tennis operation.')
    expect(homepage).not.toContain('Run the full tennis operation.')
    expect(homepage).not.toContain('Everything in the tiers above')
    expect(homepage).not.toContain('See player context across the full operation.')
    expect(homepage).not.toContain("title: 'Scout opponent'")
    expect(homepage).not.toContain("title: 'Check readiness'")
    expect(homepage).not.toContain("title: 'Send team brief'")
    expect(homepage).not.toContain("title: 'My leagues'")
    expect(homepage).not.toContain("title: 'Create tournament'")
    expect(homepage).toContain('Start with your tennis job')
    expect(homepage).toContain('Explore, improve, compete, or manage with less chaos.')
    expect(homepage).toContain('Start with the tennis map, then unlock the home base that saves your week.')
    expect(homepage).toContain('then open the home base for the next problem in your week.')
    expect(homepage).toContain('when the next tennis job needs a home base.')
    expect(homepage).toContain('Unlock My Lab, Team Hub, or League Office')
    expect(homepage).not.toContain('Start with the tennis map, then unlock the workspace that saves your week.')
    expect(homepage).not.toContain('then unlock the workspace that solves the next problem in your week.')
    expect(homepage).not.toContain('when the next tennis job needs one connected place.')
    expect(homepage).not.toContain('when that workspace saves your week')
    expect(homepage).not.toContain('Paid tiers unlock private workflows')
    expect(homepage).toContain('title="Team Hub"')
    expect(homepage).toContain('title="League Office"')
    expect(homepage).toContain('League Office')
    expect(homepage).not.toContain('Four doors. One tennis day.')
    expect(homepage).not.toContain('Captain workspace')
    expect(homepage).not.toContain('League workspace')
    expect(homepage).not.toContain('Full-Court combines Player, Coach, Captain, League')
    expect(homepage).not.toContain('Open Coach\'')
    expect(homepage).not.toContain('Open Team\'')
  })

  it('keeps legacy hero chips aligned when those components are reused', () => {
    const responsiveHero = readFileSync(join(process.cwd(), 'app/components/homepage-hero-responsive.tsx'), 'utf8')
    const animatedHero = readFileSync(join(process.cwd(), 'app/components/hero-animated.tsx'), 'utf8')

    for (const source of [responsiveHero, animatedHero]) {
      expect(source).toContain('Team Hub')
      expect(source).not.toContain('Captain workspace')
    }
  })
})
