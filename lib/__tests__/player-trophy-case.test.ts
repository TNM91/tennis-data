import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('player trophy case surface', () => {
  it('surfaces tournament honors in the player hero and full trophy case', () => {
    const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

    expect(source).toContain('featuredPlayerAwards')
    expect(source).toContain('heroAwardPill')
    expect(source).toContain('id="profile-trophy-case"')
    expect(source).toContain('League and tournament organizers can publish awards')
    expect(source).toContain('loadPublishedTiqAwardsForPlayer')
    const caseStart = source.indexOf('id="profile-trophy-case"')
    expect(caseStart).toBeLessThan(source.indexOf('<section style={{ display: \'none\' }} aria-hidden="true">', source.indexOf('id="profile-milestones"')))
    expect(source).toContain("whiteSpace: 'normal'")
    expect(source).toContain("overflowWrap: 'anywhere'")
  })
})
