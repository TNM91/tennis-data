import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('profile wording consistency', () => {
  it('uses set-profile language in the homepage portal prompt', () => {
    const homepage = source('app/components/preview-homepage.tsx')

    expect(homepage).toContain('Welcome back. Set your profile.')
    expect(homepage).toContain('Set profile')
    expect(homepage).toContain('power your tennis tools')
    expect(homepage).not.toContain('Welcome back. Improve your profile.')
    expect(homepage).not.toContain('power your workspace')
  })

  it('keeps My Lab and Captain setup prompts aligned with profile creation', () => {
    const myLab = source('app/mylab/page.tsx')
    const captain = source('app/captain/page.tsx')

    expect(myLab).toContain('Set your profile to unlock recommendations')
    expect(myLab).toContain('Set your player profile once.')
    expect(myLab).not.toContain('Improve your profile')
    expect(captain).toContain('Set profile')
    expect(captain).not.toContain('Link profile</Link>')
  })

  it('keeps Matchup and league fallbacks on set-profile language while paid upgrade handoff stays product-led', () => {
    const matchup = source('app/matchup/page.tsx')
    const upgrade = source('app/upgrade/page.tsx')
    const tiqLeague = source('app/explore/leagues/tiq/[league]/page.tsx')

    expect(matchup).toContain('Set your profile before running your own matchups.')
    expect(matchup).not.toContain('Improve profile')
    expect(upgrade).toContain("secondaryAction: 'Start Level Up'")
    expect(upgrade).toContain("secondaryAction: 'Build lineup'")
    expect(upgrade).toContain("steps: ['Open My Lab', 'Choose Level Up work', 'Compare your next match']")
    expect(tiqLeague).toContain('Player profile needed')
    expect(tiqLeague).not.toContain('Needs linked player record')
  })
})
