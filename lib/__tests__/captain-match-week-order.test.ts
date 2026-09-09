import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Captain match-week order', () => {
  it('starts with the lineup, checks selected-player replies, then sends the team update', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/captain-match-week-rail.tsx'), 'utf8')

    const lineup = source.indexOf("{ id: 'lineup', label: 'Build lineup'")
    const confirm = source.indexOf("{ id: 'availability', label: 'Check replies'")
    const send = source.indexOf("{ id: 'messaging', label: 'Send team update'")

    expect(lineup).toBeGreaterThan(-1)
    expect(confirm).toBeGreaterThan(lineup)
    expect(send).toBeGreaterThan(confirm)
  })

  it('supports in-place step actions so a completed draft is not discarded by navigation', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/captain-match-week-rail.tsx'), 'utf8')

    expect(source).toContain('onConfirmPlayers?: () => void')
    expect(source).toContain('onSendTeamUpdate?: () => void')
    expect(source).toContain("step.id === 'availability'")
    expect(source).toContain('Save lineup and check selected player replies')
    expect(source).toContain('Post the final lineup to Team Chat')
  })
})
