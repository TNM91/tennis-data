import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(path.join(process.cwd(), 'app', 'teams', '[team]', 'page.tsx'), 'utf8')

describe('team post-match result handoff', () => {
  it('prioritizes an unreported completed match and preserves its Team Room context for verified scorecard capture', () => {
    expect(source).toContain('const latestUnreportedMatch = useMemo')
    expect(source).toContain("data-team-result-status=\"not-reported\"")
    expect(source).toContain("label: 'Record result'")
    expect(source).toContain('latestUnreportedMatchRoomHref')
    expect(source).toContain('context=Team%20Match%20Pulse&type=scorecard')
    expect(source).toContain("'Close the last match before planning ahead.'")
  })
})
