import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/league-week/[token]/weekly-league-response.tsx'), 'utf8')

describe('weekly league player path', () => {
  it('keeps core league play open while connecting players to the Player experience', () => {
    expect(source).toContain('Your TIQ player path')
    expect(source).toContain('accepted sets can follow you into My TIQ Leagues')
    expect(source).toContain('MEMBERSHIP_TIERS.player_plus.upgradeCue')
    expect(source).toContain('Connect your player profile')
    expect(source).toContain('Weekly replies, court assignments, scores, and basic standings stay part of your league experience.')
    expect(source).toContain('Submit all three set scores')
    expect(source).toContain('validateLeagueWeeklySetScore')
    expect(source).toContain('max={7}')
  })
})
