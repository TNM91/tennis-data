import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getMixedPairEligibilityIssues,
  inferLeagueAgeDivision,
  inferMixedPairRole,
  isMixedPairEligible,
} from '../player-eligibility'

describe('player eligibility evidence', () => {
  it('reads age divisions without confusing NTRP levels', () => {
    expect(inferLeagueAgeDivision('2026 Adult 40 & Over', 'Women 4.0')).toBe('40 & Over')
    expect(inferLeagueAgeDivision('Junior 14 and Under', 'Boys')).toBe('14 & Under')
    expect(inferLeagueAgeDivision('Club Open', '4.0')).toBeNull()
  })

  it('uses explicit roster context and never guesses a Mixed role', () => {
    expect(inferMixedPairRole('Adult 18 & Over', 'Men 4.0')).toBe('man')
    expect(inferMixedPairRole('Adult 18 & Over', 'Women 4.0')).toBe('woman')
    expect(inferMixedPairRole('Mixed 40 & Over', '8.0')).toBe('unknown')
  })

  it('blocks a proven invalid Mixed pair but lets an unknown role remain selectable with a warning', () => {
    expect(isMixedPairEligible(true, ['man', 'woman'])).toBe(true)
    expect(isMixedPairEligible(true, ['man', 'man'])).toBe(false)
    expect(isMixedPairEligible(true, ['man', 'unknown'])).toBe(true)
    expect(getMixedPairEligibilityIssues(true, ['man', 'unknown'])).toContain(
      'Confirm each player’s Mixed team eligibility before finalizing this court.',
    )
  })

  it('connects the eligibility evidence schema to Profile and Captain', () => {
    const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260809000400_add_player_eligibility_evidence.sql'), 'utf8')
    const profile = readFileSync(join(process.cwd(), 'app/profile/page.tsx'), 'utf8')
    const captain = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')
    expect(migration).toContain('mixed_pair_role')
    expect(migration).toContain('age_division')
    expect(profile).toContain('Mixed team eligibility')
    expect(captain).toContain('getMixedPairEligibilityIssues')
    expect(captain).toContain('roster_age_division')
  })
})
