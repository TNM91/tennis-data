import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/team-league-results-workspace.tsx'), 'utf8')

describe('team result event follow-through', () => {
  it('shows match line readiness and one primary line action per event card', () => {
    expect(source).toContain('eventFollowThroughItems')
    expect(source).toContain("label: 'Lines'")
    expect(source).toContain("label: 'Complete'")
    expect(source).toContain("label: 'Review'")
    expect(source).toContain('Add lines')
    expect(source).toContain('Finish lines')
    expect(source).toContain('Review lines')
    expect(source).toContain('Hide lines')
    expect(source).toContain('Start the line card.')
    expect(source).toContain('emptyLinePanel')
    expect(source).toContain('Create the first match')
    expect(source).not.toContain('No lines yet.')
    expect(source).not.toContain('No result yet')
    expect(source).toContain('eventFollowThroughGrid')
    expect(source).toContain('eventPrimaryAction')
    expect(source).toContain('readinessDotReady')
    expect(source).toContain('readinessDotWaiting')
  })

  it('keeps the empty team result book actionable', () => {
    expect(source).toContain('function EmptyTeamResultsPanel')
    expect(source).toContain('Team results start with one match event.')
    expect(source).toContain("const dataAssistTeamResultsHref = '/data-assist?intent=upload-source&context=Team%20league%20results'")
    expect(source).toContain("href: dataAssistTeamResultsHref")
    expect(source).toContain('Add match')
    expect(source).toContain('Open calendar')
    expect(source).toContain('Upload scorecard')
    expect(source).not.toContain('No events yet. Create one above.')
    expect(source).toContain('emptyResultPanel')
    expect(source).toContain('emptyResultActions')
    expect(source).toContain('emptyResultAction')
  })

  it('groups recorded-match review controls into a responsive command panel', () => {
    expect(source).toContain('reviewCommandItems')
    expect(source).toContain("label: 'Shown'")
    expect(source).toContain("label: 'Complete'")
    expect(source).toContain("label: 'Lines'")
    expect(source).toContain('id="team-match-review"')
    expect(source).toContain('aria-labelledby="team-match-review-title"')
    expect(source).toContain('aria-label="Team result review status"')
    expect(source).toContain('aria-label="Team result review filters"')
    expect(source).toContain('reviewPanelStyle')
    expect(source).toContain('reviewCommandGridStyle')
    expect(source).toContain('reviewFilterGridStyle')
    expect(source).toContain('reviewActionRowStyle')
    expect(source).toContain('Clear filters')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))'")
  })
})
