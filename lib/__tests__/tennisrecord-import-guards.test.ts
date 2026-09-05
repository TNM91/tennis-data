import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseTennisRecordMatchPage } from '../tennisrecord/parser'
import { classifyProductionMatchCandidates, findExistingProductionMatch, type CanonicalParticipant, type ProductionMatch } from '../tennisrecord/production-match-lookup'

const fixture = readFileSync('lib/__tests__/fixtures/tennisrecord-stl-match-84487.html', 'utf8')
const url = 'https://www.tennisrecord.com/adult/matchresults.aspx?year=2026&mid=84487'
const participants: CanonicalParticipant[] = [{ playerId: 'a', side: 'A', seat: 1 }, { playerId: 'b', side: 'B', seat: 1 }]
const staged = { played_on: '2026-09-05', discipline: 'singles', fingerprint: 'fp', home_team: 'Home', away_team: 'Away', league_name: 'League', court_number: 1 }
const match: ProductionMatch = { id: 'existing', source: 'captain_upload', score: '6-4 6-3', winner_side: 'A', home_team: 'Home', away_team: 'Away', league_name: 'League', line_number: '1' }
const linksFor = (id: string, people = participants) => people.map(p => ({ match_id: id, player_id: p.playerId, side: p.side, seat: p.seat }))

describe('explicit import winner evidence', () => {
  it('does not infer a winner from straight sets or a match-tiebreak marker', () => {
    const parsed = parseTennisRecordMatchPage(fixture.replaceAll('<span>Winner</span>', ''), url)
    expect(parsed.matches).toHaveLength(2)
    expect(parsed.matches.map(m => m.winnerSide)).toEqual([null, null])
    expect(parsed.matches.map(m => m.scoreText)).toEqual(['6-3 6-7 1-0', '6-3 6-4'])
  })
  it('recognizes a legacy winner label on the right side', () => {
    const html = fixture.replaceAll('<span>Winner</span>', '').replace('John Uy (3.70)</a>', 'John Uy (3.70)</a><span>Winner</span>')
    expect(parseTennisRecordMatchPage(html, url).matches[0].winnerSide).toBe('B')
  })
  it('holds conflicting legacy labels, and conflicting arrows, for review', () => {
    const labels = fixture.replace('John Uy (3.70)</a>', 'John Uy (3.70)</a><span>Winner</span>')
    expect(parseTennisRecordMatchPage(labels, url).matches[0].winnerSide).toBeNull()
    const arrows = fixture.replaceAll('<span>Winner</span>', '').replace('<td>6 - 3<br>6 - 7', '<td><img src="arrowhead_right.png"></td><td>6 - 3<br>6 - 7').replace('1 - 0</td>', '1 - 0</td><td><img src="arrowhead_left.png"></td>')
    expect(parseTennisRecordMatchPage(arrows, url).matches[0].winnerSide).toBeNull()
  })
  it('does not treat a surname or a URL containing Winner as a winner label', () => {
    const html = fixture.replaceAll('<span>Winner</span>', '').replaceAll('Charles Kern', 'Charles Winner').replaceAll('Charles+Kern', 'Charles+Winner')
    expect(parseTennisRecordMatchPage(html, url).matches[0].winnerSide).toBeNull()
  })
  it('keeps unresolved staging out of authoritative observations and promotion', () => {
    const code = readFileSync('lib/tennisrecord/service.ts', 'utf8')
    expect(code).toContain("parse_status: match.winnerSide ? 'valid' : 'quarantined'")
    expect(code).toContain("filter(match => match.winner_side === 'A' || match.winner_side === 'B')")
    expect(code).toContain('const observationRows = valid.map')
    expect(code).toContain('existingCanonical.data?.canonical_match_id || existing?.id || null')
    expect(code.indexOf("lookup.kind === 'review'")).toBeLessThan(code.indexOf('const correction = existing'))
  })
})

describe('context-aware import duplicate checks', () => {
  it('preserves an established same-side canonical association', () => {
    expect(classifyProductionMatchCandidates({ ...staged, known_canonical_match_id: match.id }, participants, [match], linksFor(match.id))).toEqual({ kind: 'match', match })
  })
  it('does not equate matching event labels with a proven cross-source duplicate', () => {
    expect(classifyProductionMatchCandidates(staged, participants, [match], linksFor(match.id)).kind).toBe('review')
  })
  it('holds a known canonical association when its players no longer agree', () => {
    expect(classifyProductionMatchCandidates({ ...staged, known_canonical_match_id: match.id }, participants, [], [])).toEqual({ kind: 'review', candidateIds: [match.id] })
  })
  it('never merges a different court, league, team, or reversed side', () => {
    for (const changed of [{ line_number: '2' }, { league_name: 'Other' }, { home_team: 'Other' }, { league_name: null }]) {
      expect(classifyProductionMatchCandidates(staged, participants, [{ ...match, ...changed }], linksFor(match.id)).kind).toBe('review')
    }
    const reversed = participants.map(p => ({ ...p, side: p.side === 'A' ? 'B' as const : 'A' as const }))
    expect(classifyProductionMatchCandidates(staged, participants, [match], linksFor(match.id, reversed)).kind).toBe('review')
  })
  it('does not choose the first of multiple plausible same-day matches', () => {
    const second = { ...match, id: 'second' }
    expect(classifyProductionMatchCandidates(staged, participants, [match, second], [...linksFor(match.id), ...linksFor(second.id)]).kind).toBe('review')
  })
  it('recognizes a stable existing source court even if another match exists', () => {
    const source = { ...match, external_match_id: 'tennisrecord:fp::line:1' }
    const second = { ...match, id: 'second' }
    expect(classifyProductionMatchCandidates(staged, participants, [source, second], [...linksFor(source.id), ...linksFor(second.id)])).toEqual({ kind: 'match', match: source })
  })
  it('treats doubles partners as one side regardless of their seat order', () => {
    const doubles: CanonicalParticipant[] = [...participants, { playerId: 'c', side: 'A', seat: 2 }, { playerId: 'd', side: 'B', seat: 2 }]
    const swapped = doubles.map(p => ({ ...p, seat: p.seat === 1 ? 2 : 1 }))
    expect(classifyProductionMatchCandidates({ ...staged, known_canonical_match_id: match.id }, doubles, [match], linksFor(match.id, swapped)).kind).toBe('match')
  })
  it('does not match opponents who happen to share one player', () => {
    expect(classifyProductionMatchCandidates(staged, participants, [match], linksFor(match.id, [{ ...participants[0] }, { ...participants[1], playerId: 'other' }])).kind).toBe('none')
  })
})

function lookupClient(options: { candidateErrorAt?: number; linksError?: boolean; truncatedLinks?: boolean } = {}) {
  const ranges: number[] = []
  const all = Array.from({ length: 201 }, (_, i) => ({ ...match, external_match_id: i === 200 ? 'tennisrecord:fp::line:1' : null, id: i === 200 ? 'existing' : `other-${i}` }))
  const service = { from() {
    let candidateQuery = false; let ids: string[] = []
    const q = {
      select(columns: string) { candidateQuery = columns.includes('!inner'); return q },
      eq() { return q }, order() { return q }, limit() { return q },
      in(_column: string, values: string[]) { ids = values; return q },
      async range(start: number, end: number) {
        ranges.push(start)
        if (options.candidateErrorAt === start) return { data: null, error: { message: 'read failed' } }
        return { data: all.slice(start, end + 1).map(m => ({ match_id: m.id, matches: m })), error: null }
      },
      then(resolve: (value: unknown) => unknown) {
        if (candidateQuery) throw Error('Candidate query must be paginated')
        const data = options.truncatedLinks ? Array.from({ length: 1000 }, () => linksFor('x')[0]) : ids.flatMap(id => linksFor(id, id === 'existing' ? participants : [participants[0], { ...participants[1], playerId: id }]))
        return Promise.resolve(resolve({ data, error: options.linksError ? { message: 'links failed' } : null }))
      },
    }
    return q
  } } as unknown as SupabaseClient
  return { service, ranges }
}
describe('complete, fail-closed duplicate reads', () => {
  it('finds an existing match beyond the old 200-candidate limit', async () => {
    const { service, ranges } = lookupClient()
    expect(await findExistingProductionMatch(service, staged, participants)).toMatchObject({ kind: 'match', match: { id: 'existing' } })
    expect(ranges).toEqual([0, 200])
  })
  it('fails closed when a later page fails', async () => {
    await expect(findExistingProductionMatch(lookupClient({ candidateErrorAt: 200 }).service, staged, participants)).rejects.toThrow('read failed')
  })
  it('fails closed when participant links fail or reach their response cap', async () => {
    await expect(findExistingProductionMatch(lookupClient({ linksError: true }).service, staged, participants)).rejects.toThrow('links failed')
    await expect(findExistingProductionMatch(lookupClient({ truncatedLinks: true }).service, staged, participants)).rejects.toThrow('response limit')
  })
})
