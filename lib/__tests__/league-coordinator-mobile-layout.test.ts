import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'),
  'utf8',
)

describe('League Coordinator mobile layout guards', () => {
  it('stacks setup and action controls on mobile', () => {
    expect(source).toContain('responsiveHeroActionRowStyle')
    expect(source).toContain('responsiveButtonRowStyle')
    expect(source).toContain('responsiveParticipantBuilderStyle')
    expect(source).toContain('responsiveNextActionCardStyle')
    expect(source).toContain('responsiveNextActionButtonRowStyle')
    expect(source).toContain('mobileStackedActionRowStyle')
    expect(source).toContain('mobileParticipantBuilderStyle')
    expect(source).toContain('mobileNextActionCardStyle')
  })

  it('keeps the setup form Data Assist upload workflow visible', () => {
    expect(source).toContain('Upload data')
    expect(source).toContain('Use uploads as the coordinator refresh path.')
    expect(source).toContain('paste reviewed roster names from Data Assist')
    expect(source).not.toContain('USTA API')
  })
})
