import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const leagueSummary = readFileSync(join(process.cwd(), 'lib/league-summary.ts'), 'utf8')

describe('public league summary safety', () => {
  it('keeps a directory refresh bounded during historical imports', () => {
    expect(leagueSummary).toContain('const LEAGUE_SUMMARY_PAGE_SIZE = 500')
    expect(leagueSummary).toContain('const LEAGUE_SUMMARY_FETCH_LIMIT = 3000')
    expect(leagueSummary).toContain('const LEAGUE_SUMMARY_TEAM_CONTEXT_LIMIT = 5000')
    expect(leagueSummary).toContain('const LEAGUE_SUMMARY_TIMEOUT_MS = 7000')
    expect(leagueSummary).toContain('Showing the most recent')
  })
})
