import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseTennisRecordMatchPage } from '../tennisrecord/parser'
import { calculateLiveNetwork } from '../tiq-live-network'
import type { MatchRow } from '../recalculateRatings'
const fixture = readFileSync('lib/__tests__/fixtures/tennisrecord-stl-match-84487.html', 'utf8')
const url = 'https://www.tennisrecord.com/adult/matchresults.aspx?year=2026&mid=84487'
describe('imported completion markers', () => {
  it.each(['Retired', 'Retirement', 'Defaulted', 'Walkover', 'W / O'])('preserves %s and prevents rating snapshots', marker => {
    const html = fixture.replace('6 - 3<br>6 - 7<br>1 - 0', '6 - 1<br>1 - 0<br><span>' + marker + '</span>')
    const parsed = parseTennisRecordMatchPage(html, url).matches[0]
    expect(parsed.scoreText).toMatch(/^6-1 1-0 (retired|default|walkover)$/)
    const match: MatchRow = { id: 'court', match_date: parsed.playedOn!, match_type: 'singles', score: parsed.scoreText, winner_side: 'A', match_source: 'usta', rating_eligible: true, league_name: parsed.leagueName }
    const result = calculateLiveNetwork({ season: 2026, cutoff: '2026-10-04', matches: [match], participants: [{ match_id: 'court', player_id: 'a', side: 'A' }, { match_id: 'court', player_id: 'b', side: 'B' }], priors: new Map([['a', 4]]), excluded: new Set(), conflictedMatches: new Set() })
    expect(result.snapshots).toEqual([])
    expect(result.skippedMatches).toEqual([{ matchId: 'court', reason: 'incomplete_score' }])
  })
  it('keeps completed scores and does not transfer another court status', () => {
    const html = fixture.replace('6 - 3<br>6 - 7<br>1 - 0', '6 - 3<br>6 - 7<br>1 - 0<br>Retired')
    const parsed = parseTennisRecordMatchPage(html, url)
    expect(parsed.matches[1].scoreText).toBe('6-3 6-4')
    expect(parseTennisRecordMatchPage(fixture, url).matches[0].scoreText).toBe('6-3 6-7 1-0')
  })
})
