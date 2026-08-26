import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Captain match-week order', () => {
  it('starts with the lineup, confirms selected players, then sends the team update', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/captain-match-week-rail.tsx'), 'utf8')

    const lineup = source.indexOf("{ id: 'lineup', label: 'Build lineup'")
    const confirm = source.indexOf("{ id: 'availability', label: 'Confirm players'")
    const send = source.indexOf("{ id: 'messaging', label: 'Send team update'")

    expect(lineup).toBeGreaterThan(-1)
    expect(confirm).toBeGreaterThan(lineup)
    expect(send).toBeGreaterThan(confirm)
  })
})
