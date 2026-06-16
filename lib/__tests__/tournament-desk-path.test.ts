import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

describe('Tournament Desk organizer path', () => {
  it('answers the core tournament organizer questions with practical anchors', () => {
    expect(source).toContain('tournamentDeskPaths')
    expect(source).toContain('Tournament Desk path')
    expect(source).toContain('PRODUCT_MOTTO')
    expect(source).toContain('Start with the event question, then open the tool that removes the most admin work.')

    expect(source).toContain("question: 'How do I organize schedules?'")
    expect(source).toContain("question: 'How do I manage players or teams?'")
    expect(source).toContain("question: 'How do I track scores?'")
    expect(source).toContain("question: 'How do I reduce admin work?'")

    expect(source).toContain("href: '#tournament-setup'")
    expect(source).toContain("href: '#tournament-entries'")
    expect(source).toContain("href: '#tournament-scorebook'")
    expect(source).toContain("href: '#tournament-alerts'")
  })

  it('keeps the path tappable and measurable on mobile', () => {
    expect(source).toContain('gridTemplateColumns: \'repeat(auto-fit, minmax(min(100%, 230px), 1fr))\'')
    expect(source).toContain('data-tournament-path-job={path.job}')
    expect(source).toContain('aria-label={`${path.cta}: ${path.question}`}')
    expect(source).toContain('tournamentPathCardStyle')
  })
})
