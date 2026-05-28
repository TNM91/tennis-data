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
    expect(homepage).toContain("href: '/league-coordinator/tournaments'")
    expect(homepage).toContain("queue: ['Shared calendar', 'Build tournament', 'Team book', 'Player book']")
    expect(homepage).toContain("queue: ['Build tournament', 'Run team week', 'Track results', 'Open player book']")
    expect(homepage).not.toContain("title: 'Scout opponent'")
    expect(homepage).not.toContain("title: 'Check readiness'")
    expect(homepage).not.toContain("title: 'Send team brief'")
    expect(homepage).not.toContain("title: 'My leagues'")
    expect(homepage).not.toContain("title: 'Create tournament'")
  })
})
