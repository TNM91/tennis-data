import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('weekly rotating-partner score validation', () => {
  it('enforces the set rule for both player submissions and owner review', () => {
    const playerRoute = read('app/api/leagues/weekly/[token]/route.ts')
    const ownerRoute = read('app/api/leagues/weekly/sessions/[sessionId]/scores/route.ts')
    const ownerPanel = read('app/league-coordinator/weekly/weekly-score-intelligence-panel.tsx')

    expect(playerRoute).toContain('validateLeagueWeeklySetScore(sideAGames, sideBGames)')
    expect(ownerRoute).toContain('validateLeagueWeeklySetScore(sideAGames, sideBGames)')
    expect(ownerPanel).toContain('validateLeagueWeeklySetScore(sideAGames, sideBGames)')
    expect(ownerPanel).toContain('max={7}')
  })
})
