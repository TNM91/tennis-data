import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('teams award badges', () => {
  it('surfaces team league awards as certificate links without wrapping the whole card', () => {
    const source = readFileSync(join(process.cwd(), 'app/teams/page.tsx'), 'utf8')

    expect(source).toContain('loadRecentTiqAwards')
    expect(source).toContain('awardsByTeamName')
    expect(source).toContain('TeamAwardBadges')
    expect(source).toContain('teamAwardPillStyle')
    expect(source).toContain('/awards/')
    expect(source).toContain('recipientPlayerId')
    expect(source).not.toContain('style={teamCardLink}')
  })
})
