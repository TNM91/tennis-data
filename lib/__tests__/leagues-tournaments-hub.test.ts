import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const hubSource = readFileSync(join(process.cwd(), 'app/leagues-and-tournaments/page.tsx'), 'utf8')
const navigationSource = readFileSync(join(process.cwd(), 'lib/site-navigation.ts'), 'utf8')
const portalSource = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')
const productStorySource = readFileSync(join(process.cwd(), 'lib/product-story.ts'), 'utf8')
const commandCenterSource = readFileSync(join(process.cwd(), 'app/components/public-command-center.tsx'), 'utf8')

describe('Leagues and tournaments hub', () => {
  it('gives the combined organizer nav item a real public hub', () => {
    expect(navigationSource).toContain("href: '/leagues-and-tournaments', label: 'Leagues & Tournaments'")
    expect(navigationSource).toContain('Organize seasons, events, players, teams, scores, and results.')
    expect(portalSource).toContain("route: '/leagues-and-tournaments'")
    expect(productStorySource).toContain("href: '/leagues-and-tournaments'")
    expect(commandCenterSource).toContain("href: '/leagues-and-tournaments'")
  })

  it('keeps organizer copy practical and role-specific', () => {
    expect(hubSource).toContain("title: 'Leagues & Tournaments'")
    expect(hubSource).toContain('Run competition with less admin work.')
    expect(hubSource).toContain('Organizer work path')
    expect(hubSource).toContain('Set up, schedule, score, publish.')
    expect(hubSource).toContain('organize schedules, manage players or teams, track scores, publish updates, and reduce admin work')
    expect(hubSource).toContain('Set up a league')
    expect(hubSource).toContain('Set Up League')
    expect(hubSource).toContain('Set up a tournament')
    expect(hubSource).toContain('Set Up Tournament')
    expect(hubSource).toContain('Track scores')
    expect(hubSource).toContain('Track Scores')
    expect(hubSource).toContain('Publish updates')
    expect(hubSource).toContain('Publish Updates')
    expect(hubSource).toContain("href: '/league-coordinator/results'")
    expect(hubSource).toContain('League Office')
    expect(hubSource).toContain('Tournament Desk')
    expect(hubSource).toContain('Data Assist')
  })
})
