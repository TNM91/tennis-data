import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function styleBlock(source: string, styleName: string) {
  const start = source.indexOf(`const ${styleName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

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

  it('keeps alert preference fields keyboard focus-visible', () => {
    const source = readFileSync(join(process.cwd(), 'app/tournaments/[id]/preferences/page.tsx'), 'utf8')

    expect(source).toContain('const [focusedField, setFocusedField] = useState<string | null>(null)')
    expect(source).toContain("onFocus={() => setFocusedField('name')}")
    expect(source).toContain("onFocus={() => setFocusedField('phone')}")
    expect(source).toContain('const inputFocusStyle: CSSProperties')
    expect(styleBlock(source, 'inputStyle')).toContain("outline: '2px solid transparent'")
    expect(styleBlock(source, 'inputStyle')).toContain('outlineOffset: 2')
    expect(styleBlock(source, 'inputStyle')).not.toContain("outline: 'none'")
  })
})
