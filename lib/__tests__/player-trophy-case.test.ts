import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('player trophy case surface', () => {
  it('surfaces tournament honors in the player hero and full trophy case', () => {
    const source = readFileSync(join(process.cwd(), 'app/players/[id]/page.tsx'), 'utf8')

    expect(source).toContain('featuredPlayerAwards')
    expect(source).toContain('heroAwardPill')
    expect(source).toContain('id="profile-trophy-case"')
    expect(source).toContain('Tournament awards attach here')
    expect(source).toContain('loadTiqAwardsForPlayer')
    expect(source).toContain("whiteSpace: 'normal'")
    expect(source).toContain("overflowWrap: 'anywhere'")
  })
})
