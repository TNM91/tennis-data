import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('tournament preferences consent checklist', () => {
  it('shows compact consent readiness before saving text preferences', () => {
    const source = readFileSync(join(process.cwd(), 'app/tournaments/[id]/preferences/page.tsx'), 'utf8')

    expect(source).toContain('consentSteps')
    expect(source).toContain('Text alert consent checklist')
    expect(source).toContain('consentStepStyle')
    expect(source).toContain('readinessDotReadyStyle')
    expect(source).toContain('readinessDotWaitingStyle')
    expect(source).toContain('complianceNoteStyle')
    expect(source).toContain('Every text includes a TenAceIQ link and opt-out language. Reply STOP anytime.')
    expect(source).not.toContain('consentCardStyle')
  })
})
