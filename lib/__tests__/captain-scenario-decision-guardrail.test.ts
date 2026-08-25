import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/scenario-builder/page.tsx'), 'utf8')

describe('Captain scenario decision guardrail', () => {
  it('adds distinct guidance for tight, volatile, and ready comparisons', () => {
    expect(source).toContain('const scenarioDecisionGuardrail = useMemo(() =>')
    expect(source).toContain("if (separationLabel === 'Tight call')")
    expect(source).toContain("value: 'Keep both live'")
    expect(source).toContain('if (changedCourts > 3)')
    expect(source).toContain("value: 'Verify the swaps'")
    expect(source).toContain("value: 'Ready to carry forward'")
  })

  it('renders the guardrail in the compact scenario decision read', () => {
    expect(source).toContain('aria-label="Scenario decision guardrail"')
    expect(source).toContain('Decision guardrail')
    expect(source).toContain('{scenarioDecisionGuardrail.value}')
  })
})
