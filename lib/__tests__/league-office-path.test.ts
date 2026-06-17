import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'), 'utf8')

describe('League Office organizer path', () => {
  it('answers the core league coordinator questions with practical anchors', () => {
    expect(source).toContain('leagueOfficePaths')
    expect(source).toContain('League Office path')
    expect(source).toContain('PRODUCT_MOTTO')
    expect(source).toContain('Start with the season question, then open the workspace that removes the most admin work.')

    expect(source).toContain("question: 'How do I organize schedules?'")
    expect(source).toContain("question: 'How do I manage players or teams?'")
    expect(source).toContain("question: 'How do I track scores?'")
    expect(source).toContain("question: 'How do I reduce admin work?'")

    expect(source).toContain("href: '#shared-calendar'")
    expect(source).toContain("href: '#league-registry'")
    expect(source).toContain('href: resultEntryHref')
    expect(source).toContain("href: '#league-public-pages'")
  })

  it('keeps the path tappable and measurable on mobile', () => {
    expect(source).toContain('gridTemplateColumns: \'repeat(auto-fit, minmax(min(100%, 230px), 1fr))\'')
    expect(source).toContain('gridTemplateColumns: \'38px minmax(0, 1fr)\'')
    expect(source).toContain('data-league-path-job={path.job}')
    expect(source).toContain('aria-label={`${path.cta}: ${path.question}`}')
    expect(source).toContain('leaguePathMarkerStyle')
  })
})
