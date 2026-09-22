import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Captain lineup results review', () => {
  const page = readFileSync(join(process.cwd(), 'app/captain/analytics/page.tsx'), 'utf8')

  it('links saved scenarios to canonical completed team matches without inferring results', () => {
    expect(page).toContain('function findScenarioOutcome(scenario: ScenarioRow, results: TeamMatchResult[]): ScenarioOutcome | null')
    expect(page).toContain(".from('matches')")
    expect(page).toContain(".is('line_number', null)")
    expect(page).toContain(".not('winner_side', 'is', null)")
    expect(page).toContain('const scenarioOutcomes = useMemo(() =>')
    expect(page).toContain('Lineup results')
    expect(page).toContain('Result waiting')
    expect(page).toContain("outcome ? `${outcome.result}${outcome.score ? ` - ${outcome.score}` : ''}` : 'Result waiting'")
  })
})
