import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')

describe('Captain lineup builder save and insights flow', () => {
  it('keeps background text preparation from presenting an Ask message', () => {
    expect(source).toContain("setMessage('Lineup updated. Your draft is saved on this phone.')")
    expect(source).toContain('if (!options.silent) {\n      setAskingCourtId(slot.id)')
    expect(source).toContain('if (!options.silent) {\n        setMessage(`${invitedPlayer.playerName} is ready.')
    expect(source).toContain('if (!options.silent) {\n        setError(caught instanceof Error')
  })

  it('makes saving an intentional first action and keeps optional analysis collapsed on phones', () => {
    expect(source).toContain('Draft saved on this phone')
    expect(source).toContain("currentScenarioId ? 'Update saved lineup' : 'Save lineup'")
    expect(source).toContain('Scorecard, strategy, and next steps')
    expect(source).toContain('<details open={!isMobile} style={isMobile ? surfaceCardStrong : desktopInsightsDisclosureStyle}>')
    expect(source).toContain('Build a recommended draft')
  })
})
