import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('players directory award badges', () => {
  it('surfaces award badges on player cards and links them to trophy cases', () => {
    const source = readFileSync(join(process.cwd(), 'app/players/page.tsx'), 'utf8')

    expect(source).toContain('loadRecentTiqAwards')
    expect(source).toContain('awardsByPlayerId')
    expect(source).toContain('playerAwardRowStyle')
    expect(source).toContain('playerAwardPillStyle')
    expect(source).toContain('playerAwardCaseLinkStyle')
    expect(source).toContain('/awards/')
    expect(source).toContain('#profile-trophy-case')
    expect(source).toContain('Trophy case')
    expect(source).toContain("award.sourceType === 'league' ? 'League' : 'Tournament'")
  })
})
