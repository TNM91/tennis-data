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
    expect(navigationSource).toContain("{ href: '/leagues-and-tournaments', label: 'Leagues & Tournaments' }")
    expect(portalSource).toContain("route: '/leagues-and-tournaments'")
    expect(productStorySource).toContain("href: '/leagues-and-tournaments'")
    expect(commandCenterSource).toContain("href: '/leagues-and-tournaments'")
  })

  it('keeps organizer copy practical and role-specific', () => {
    expect(hubSource).toContain("title: 'Leagues & Tournaments'")
    expect(hubSource).toContain('Run competition with less admin work.')
    expect(hubSource).toContain('Choose the job before the tool.')
    expect(hubSource).toContain('Find league context')
    expect(hubSource).toContain('Run a league season')
    expect(hubSource).toContain('Run a tournament')
    expect(hubSource).toContain('Fix schedules, rosters, or scores')
    expect(hubSource).toContain('League Office')
    expect(hubSource).toContain('Tournament Desk')
    expect(hubSource).toContain('Data Assist')
  })
})
