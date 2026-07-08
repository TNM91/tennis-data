import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

describe('Tournament Desk organizer path', () => {
  it('answers the core tournament organizer questions with practical anchors', () => {
    expect(source).toContain('tournamentDeskPaths')
    expect(source).toContain('tournamentPathStatusItems')
    expect(source).toContain('tournamentPathActions')
    expect(source).toContain('Tournament Desk path')
    expect(source).toContain('PRODUCT_MOTTO')
    expect(source).toContain('Scan the room, then jump to the tournament task that needs attention.')
    expect(source).toContain('Control tower')
    expect(source).toContain('Keep the event moving.')
    expect(source).toContain('Build the room first.')
    expect(source).toContain('Tournament Desk status scan')

    expect(source).toContain("question: 'How do I organize schedules?'")
    expect(source).toContain("question: 'How do I manage players or teams?'")
    expect(source).toContain("question: 'How do I track scores?'")
    expect(source).toContain("question: 'How do I reduce admin work?'")
    expect(source).toContain("label: 'Schedule and courts'")
    expect(source).toContain("label: 'Entries and profiles'")
    expect(source).toContain("label: 'Scores and standings'")
    expect(source).toContain("label: 'Alerts and recaps'")
    expect(source).toContain('<em>{path.label}</em>')
    expect(source).toContain("cta: 'Save room first'")

    expect(source).toContain("href: '#tournament-setup'")
    expect(source).toContain("href: '#tournament-entries'")
    expect(source).toContain("href: '#tournament-scorebook'")
    expect(source).toContain("href: '#tournament-alerts'")
  })

  it('keeps the path tappable and measurable on mobile', () => {
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))'")
    expect(source).toContain("gridTemplateColumns: '38px minmax(0, 1fr) minmax(0, auto)'")
    expect(source).toContain("gridColumn: '2 / -1'")
    expect(source).toContain('data-tournament-path-job={path.job}')
    expect(source).toContain('aria-label={`${path.cta}: ${path.question}`}')
    expect(source).toContain('tournamentPathCardStyle')
    expect(source).toContain('tournamentPathCommandStyle')
    expect(source).toContain('tournamentPathStatusDetailStyle')
  })
})
