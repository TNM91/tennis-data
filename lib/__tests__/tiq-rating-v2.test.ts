import { describe, expect, it } from 'vitest'
import { formatTiqV2Strength, replayTiqV2, tiqV2Band, type V2Match, type V2Prior } from '../tiq-rating-v2'
const priors: V2Prior[] = ['a', 'b', 'c', 'd'].map(playerId => ({ playerId, level: 4.5, season: 2025, source: 'fixture', independentlyVerified: true }))
const match: V2Match = { id: 'one', match_date: '2026-02-01', match_type: 'doubles', score: '6-0 6-0', winner_side: 'A', match_source: 'usta', rating_eligible: true, ustaEligible: true, eligibilityPolicy: 'fixture', participants: [{ playerId: 'a', side: 'A' }, { playerId: 'b', side: 'A' }, { playerId: 'c', side: 'B' }, { playerId: 'd', side: 'B' }] }
const replay = (matches: V2Match[], extra = {}) => replayTiqV2({ season: 2026, startsOn: '2026-01-01', cutoff: '2026-10-02', priors, matches, explainPlayerId: 'a', ...extra })
describe('versioned TiQ band shadow replay', () => {
  it('starts within the band and never rounds a value into the next band', () => {
    expect(replay([]).players[0].playing.overall.strength).toBe(4.75)
    expect(tiqV2Band(4.999)).toBe(4.5)
    expect(formatTiqV2Strength(4.999)).toBe('4.99')
    expect(tiqV2Band(5)).toBe(5)
    expect(() => tiqV2Band(NaN)).toThrow()
  })
  it('uses all four pre-match strengths, moves both directions and separates formats', () => {
    const report = replay([match])
    expect(report.players[0].playing.doubles.strength).toBeGreaterThan(4.75)
    expect(report.players[2].playing.doubles.strength).toBeLessThan(4.75)
    expect(report.players[0].playing.singles.strength).toBe(4.75)
    expect(report.explanations[0].participants).toHaveLength(4)
    expect(report.explanations[0].expectedGameShare).toBe(0.5)
    expect(report.explanations[0].actualGameShare).toBe(1)
    expect(report.releaseEligible).toBe(false)
    expect(report.probabilities).toBeNull()
  })
  it('keeps unconfirmed section results out of the USTA track while playing strength evolves', () => {
    const report = replay([{ ...match, ustaEligible: false }])
    expect(report.players[0].playing.doubles.matches).toBe(1)
    expect(report.players[0].usta.doubles.matches).toBe(0)
  })
  it('orients winner-first evidence only with explicit source provenance', () => {
    const winnerFirst = { ...match, winner_side: 'B' as const, scoreOrientation: 'winner-first' as const }
    expect(replay([winnerFirst]).processedMatches).toBe(0)
    const report = replay([{ ...winnerFirst, scoreEvidenceId: 'verified-source-observation' }])
    expect(report.processedMatches).toBe(1)
    expect(report.players[0].playing.doubles.strength).toBeLessThan(4.75)
    expect(report.explanations[0].originalScore).toBe('6-0 6-0')
    expect(report.explanations[0].processedScore).toBe('0-6 0-6')
  })
  it('uses preceding opponent/partner results and is independent of input ordering', () => {
    const earlier: V2Match = { ...match, id: 'earlier', match_date: '2026-01-15', participants: [{ playerId: 'c', side: 'A' }, { playerId: 'd', side: 'A' }, { playerId: 'b', side: 'B' }, { playerId: 'e', side: 'B' }] }
    const extra = { priors: [...priors, { ...priors[0], playerId: 'e' }] }
    const chronological = replay([earlier, match], extra)
    expect(chronological.explanations[0].expectedGameShare).toBeLessThan(0.5)
    expect(replay([match, earlier], extra)).toEqual(chronological)
  })
  it('blends observed singles and doubles instead of letting an untouched format dilute the read', () => {
    const singles: V2Match = { ...match, id: 'singles', match_date: '2026-03-01', match_type: 'singles', score: '0-6 0-6', winner_side: 'B', participants: [{ playerId: 'a', side: 'A' }, { playerId: 'c', side: 'B' }] }
    const player = replay([match, singles]).players[0]
    expect(player.playing.overall.matches).toBe(2)
    expect(player.playing.overall.strength).toBeCloseTo((player.playing.singles.strength + player.playing.doubles.strength) / 2)
    expect(replay([match]).players[0].playing.overall.strength).toBe(replay([match]).players[0].playing.doubles.strength)
  })
  it('excludes future, duplicate, incomplete and conflicting evidence without mutating inputs', () => {
    const original = JSON.stringify(match)
    const report = replay([match, match, { ...match, id: 'future', match_date: '2027-01-01' }, { ...match, id: 'retired', score: '6-0 retired' }])
    expect(report.processedMatches).toBe(1)
    expect(report.skipped).toEqual({ duplicate: 1, incomplete_score: 1, outside_window: 1 })
    expect(JSON.stringify(match)).toBe(original)
    expect(replay([match], { priors: [...priors, { ...priors[0], level: 4 }] }).skipped.missing_or_conflicting_prior).toBe(1)
  })
})
