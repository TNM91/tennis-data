import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/individual-league-results-workspace.tsx'), 'utf8')

describe('individual result follow-through', () => {
  it('shows profile, score, and date readiness with one primary follow-up action', () => {
    expect(source).toContain('resultFollowThroughItems')
    expect(source).toContain("label: 'Profiles'")
    expect(source).toContain("label: 'Score'")
    expect(source).toContain("label: 'Date'")
    expect(source).toContain('Open winner')
    expect(source).toContain('Create profiles')
    expect(source).toContain("value: profilesReady ? 'Ready' : 'Needed'")
    expect(source).toContain('resultFollowThroughGrid')
    expect(source).toContain('resultPrimaryAction')
    expect(source).toContain('readinessDotReady')
    expect(source).toContain('readinessDotWaiting')
    expect(source).toContain('Log the first result')
    expect(source).not.toContain('No result yet')
    expect(source).not.toContain('>Winner</Link>')
  })

  it('keeps the empty player result book actionable', () => {
    expect(source).toContain('function EmptyIndividualResultsPanel')
    expect(source).toContain('Player results start with one finished match.')
    expect(source).toContain("const dataAssistIndividualResultsHref = '/data-assist?intent=upload-source&context=Individual%20league%20results'")
    expect(source).toContain("href: dataAssistIndividualResultsHref")
    expect(source).toContain('Log player result')
    expect(source).toContain('Set up league')
    expect(source).toContain('Upload scorecard')
    expect(source).not.toContain('No individual results yet. Open the form above to log the first player result.')
    expect(source).toContain('emptyResultPanel')
    expect(source).toContain('emptyResultActions')
    expect(source).toContain('emptyResultAction')
  })

  it('groups recorded player result controls into a responsive command panel', () => {
    expect(source).toContain('reviewCommandItems')
    expect(source).toContain("label: 'Shown'")
    expect(source).toContain("label: 'Clean'")
    expect(source).toContain("label: 'Corrections'")
    expect(source).toContain("label: 'Players'")
    expect(source).toContain('aria-labelledby="player-result-book-title"')
    expect(source).toContain('aria-label="Player result review status"')
    expect(source).toContain('aria-label="Player result review filters"')
    expect(source).toContain('reviewPanelStyle')
    expect(source).toContain('reviewCommandGridStyle')
    expect(source).toContain('reviewFilterGridStyle')
    expect(source).toContain('reviewActionRowStyle')
    expect(source).toContain('Clear filters')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))'")
  })

  it('consolidates player result next steps into one command center', () => {
    expect(source).toContain('aria-label="Player result command center"')
    expect(source).toContain('Result book scan')
    expect(source).toContain('aria-label="Player result readiness scan"')
    expect(source).toContain('data-player-result-path-job="next_best_action"')
    expect(source).not.toContain('Result entry readiness')
    expect(source).not.toContain('const readinessPanel: CSSProperties')
  })
})
