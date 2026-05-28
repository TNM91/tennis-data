import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('public tournament award certificates', () => {
  it('links podium awards to certificates and player trophy cases', () => {
    const source = readFileSync(join(process.cwd(), 'app/tournaments/[id]/page.tsx'), 'utf8')

    expect(source).toContain('loadTiqAwardsForSource')
    expect(source).toContain('podiumActionRowStyle')
    expect(source).toContain('Certificate')
    expect(source).toContain('/awards/')
    expect(source).toContain('#profile-trophy-case')
    expect(source).toContain('Trophy case starts when the player profile is linked.')
    expect(source).toContain('buildTournamentPodiumSummary')
    expect(source).toContain('Share results')
    expect(source).toContain('buildTournamentPodiumMailto')
    expect(source).toContain('#podium')
  })
})
