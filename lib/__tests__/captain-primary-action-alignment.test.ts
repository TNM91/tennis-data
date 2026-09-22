import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')

describe('Captain primary action alignment', () => {
  it('keeps the captain home headline aligned with the first incomplete weekly step', () => {
    expect(source).toContain('const captainReadinessAction = useMemo(() =>')
    expect(source).toContain("captainReadinessNext.label === 'Availability'")
    expect(source).toContain("title: 'Close the reply gap'")
    expect(source).toContain("captainReadinessNext.label === 'Projection'")
    expect(source).toContain("title: 'Open the lineup projection'")
    expect(source).toContain("captainReadinessNext.label === 'Lineup'")
    expect(source).toContain("title: 'Build the weekly lineup'")
    expect(source).toContain("title: 'Send the weekly plan'")
  })

  it('uses the same readiness action for the primary card copy and its destination', () => {
    expect(source).toContain('...captainReadinessAction,')
    expect(source).toContain('href: captainReadinessNext.href')
    expect(source).toContain('cta: captainReadinessNext.cta')
    expect(source).not.toContain("title: captainReadinessNext.label === 'Team scope' ? 'Choose the team week' : nextAction.title")
  })
})
