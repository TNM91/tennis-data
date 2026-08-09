import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assessPlayerEligibility,
  buildPlayerEligibilityRequirement,
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

  it('assesses registration evidence without treating missing evidence as a rejection', () => {
    const requirement = buildPlayerEligibilityRequirement('Women 4.0', 'Adult 40 & Over')
    expect(assessPlayerEligibility(requirement, {
      rating: 4,
      ratingSource: 'verified',
      mixedPairRole: 'woman',
      mixedPairRoleSource: 'verified',
      ageDivisions: ['40 & Over'],
      ageDivisionSource: 'verified',
    }).status).toBe('verified')
    expect(assessPlayerEligibility(requirement, {
      rating: 4,
      ratingSource: 'self',
      mixedPairRole: 'woman',
      mixedPairRoleSource: 'self',
      ageDivisions: [],
    }).status).toBe('needs_confirmation')
    expect(assessPlayerEligibility(requirement, {
      rating: 4.5,
      ratingSource: 'verified',
      mixedPairRole: 'woman',
      mixedPairRoleSource: 'verified',
      ageDivisions: ['40 & Over'],
      ageDivisionSource: 'verified',
    }).status).toBe('ineligible')
    expect(assessPlayerEligibility(requirement, {
      rating: 4.5,
      ratingSource: 'self',
      mixedPairRole: 'woman',
      mixedPairRoleSource: 'self',
      ageDivisions: ['40 & Over'],
      ageDivisionSource: 'self',
    }).status).toBe('needs_confirmation')
  })

  it('does not mistake notes or multi-level formats for one NTRP division', () => {
    expect(buildPlayerEligibilityRequirement('Three matches guaranteed').ratingLevel).toBeNull()
    expect(buildPlayerEligibilityRequirement('Tri-Level 3.5 / 4.0 / 4.5').ratingLevel).toBeNull()
    expect(buildPlayerEligibilityRequirement('Women 4.0').ratingLevel).toBe(4)
  })

  it('carries eligibility evidence through tournament and League Office approvals', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260809000500_add_entry_eligibility_reviews.sql'),
      'utf8',
    )
    const tournament = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')
    const leagueOffice = readFileSync(join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'), 'utf8')
    const leagueService = readFileSync(join(process.cwd(), 'lib/tiq-league-service.ts'), 'utf8')

    expect(migration).toContain('alter table public.tiq_tournament_entries')
    expect(migration).toContain('alter table public.tiq_player_league_entries')
    expect(migration).toContain('eligibility_reviewed_by')
    expect(tournament).toContain('Confirm & approve')
    expect(tournament).toContain('updateTiqTournamentEntryStatus')
    expect(leagueOffice).toContain('leagueEligibilityPillStyle')
    expect(leagueOffice).toContain('does not match this division')
    expect(leagueService).toContain('attachPlayerEligibilityAssessments')
    expect(leagueService).toContain('eligibility_reviewed_by: userId')
  })

  it('collects missing evidence before tournament and individual-league registration', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260809000600_add_registration_eligibility_evidence.sql'),
      'utf8',
    )
    const tournamentEntry = readFileSync(join(process.cwd(), 'app/tournaments/[id]/page.tsx'), 'utf8')
    const leagueEntry = readFileSync(join(process.cwd(), 'app/explore/leagues/tiq/[league]/page.tsx'), 'utf8')
    const evidenceLoader = readFileSync(join(process.cwd(), 'lib/registration-player-evidence.ts'), 'utf8')

    expect(migration).toContain('eligibility_rating_source')
    expect(migration).toContain('eligibility_age_division_source')
    expect(migration).toContain('submitted_by_user_id = auth.uid()')
    expect(migration).toContain('p.linked_player_id::text = player_id')
    expect(tournamentEntry).toContain('TIQ profile connected')
    expect(tournamentEntry).toContain('Complete the highlighted eligibility check')
    expect(leagueEntry).toContain('Your TIQ player is connected')
    expect(leagueEntry).not.toContain('Choose an existing TenAceIQ player')
    expect(evidenceLoader).toContain('loadUserProfileLink')
    expect(evidenceLoader).toContain("rating_source) === 'verified'")
  })
})
