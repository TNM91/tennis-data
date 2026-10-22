import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadReviewedCaptainCourts, validateReviewedCaptainCourt, reviewedCaptainObservation, type ReviewedCaptainCourt } from '../tennisrecord/reviewed-captain-courts'
import type { CanonicalParticipant } from '../tennisrecord/production-match-lookup'
import { reconcileTennisRecordMatches } from '../tennisrecord/service'

const url = 'https://www.tennisrecord.com/adult/matchresults.aspx?year=2027&mid=123'
const item = { source_url: url, played_on: '2026-09-20', league_name: 'Source league', flight: '4.5', home_team: 'Source A', away_team: 'Source B', discipline: 'singles', court_number: 1, score_text: '6-4 6-3', winner_side: 'B', participants: [{ sourcePlayerKey: 'sa', side: 'A', seat: 1 }, { sourcePlayerKey: 'sb', side: 'B', seat: 1 }] }
const identities: CanonicalParticipant[] = [{ playerId: 'a', side: 'A', seat: 1 }, { playerId: 'b', side: 'B', seat: 1 }]
function fixture(): ReviewedCaptainCourt {
  const parent = { id: 'parent', external_match_id: 'captain-scorecard:event', match_date: item.played_on, league_name: 'Captain league', flight: 'Men 4.5 (F)', home_team: 'Captain B', away_team: 'Captain A', facility: 'Court', source: 'captain_scorecard', match_source: 'usta', status: 'completed' }
  const court = { id: 'court', external_match_id: `${parent.external_match_id}::line:1`, match_date: item.played_on, league_name: parent.league_name, flight: parent.flight, match_type: 'singles', line_number: '1', facility: parent.facility, source: parent.source, match_source: 'usta', status: 'completed', score: '6-4;6-3', winner_side: 'A' as const, match_players: [{ player_id: 'b', side: 'A' }, { player_id: 'a', side: 'B' }] }
  return { source_event_id: 'tennisrecord:2027:123', discipline: 'singles', court_number: 1, canonical_match_id: court.id, canonical_parent_id: parent.id, source_page_id: 'page', rating_processed_at: '2026-10-22T08:17:00Z',
    court, parent, evidence: { id: 'page', source_url: url, blocked: false, http_status: 200 }, source_snapshot: { ...item, participants: item.participants.map((p,i) => ({ ...p, playerId: identities[i].playerId })) }, court_snapshot: { ...court, participants: court.match_players.map(p => ({ playerId: p.player_id, side: p.side })) }, parent_snapshot: { ...parent } }
}

describe('explicit reviewed captain courts', () => {
  it('binds an exact event and court while preserving reversed-side winners and score formatting', () => {
    const context = validateReviewedCaptainCourt(fixture(), item, identities)!
    expect(context.reversed).toBe(true)
    expect(reviewedCaptainObservation(context, item)).toMatchObject({ score_text: item.score_text, winner_side: 'B', raw: { originalScore: '6-4;6-3', originalWinnerSide: 'A', sourceSidesReversed: true } })
    expect(context.match.score).toBe('6-4;6-3')
    expect(context.match.winner_side).toBe('A')
  })
  it.each(['source_url','played_on','home_team','away_team','league_name','flight','discipline','court_number'])('rejects changed source identity: %s', field => {
    expect(validateReviewedCaptainCourt(fixture(), { ...item, [field]: field === 'source_url' ? url.replace('123','456') : 'changed' }, identities)).toBeNull()
  })
  it.each(['external_match_id','match_date','league_name','flight','match_type','line_number','facility','source','status'])('rejects changed canonical identity: %s', field => {
    const link = fixture(); Object.assign(link.court!, { [field]: 'changed' })
    expect(validateReviewedCaptainCourt(link, item, identities)).toBeNull()
  })
  it('rejects a changed parent, evidence, player mapping, duplicate or missing player', () => {
    for (const change of [(l: ReviewedCaptainCourt) => { l.parent!.home_team = 'Different team' }, (l: ReviewedCaptainCourt) => { l.evidence!.blocked = true }, (l: ReviewedCaptainCourt) => { l.evidence!.source_url = url.replace('123','456') }, (l: ReviewedCaptainCourt) => { l.court!.match_players[0].player_id = 'other' }]) {
      const link = fixture(); change(link); expect(validateReviewedCaptainCourt(link, item, identities)).toBeNull()
    }
    expect(validateReviewedCaptainCourt(fixture(), item, null)).toBeNull()
    expect(validateReviewedCaptainCourt(fixture(), item, [{ ...identities[0] }, { ...identities[1], playerId: 'a' }])).toBeNull()
    expect(validateReviewedCaptainCourt(fixture(), item, [{ ...identities[0], playerId: 'other' }, identities[1]])).toBeNull()
  })
  it('preserves genuine winner and score conflicts instead of copying source results over a captain result', () => {
    const link = fixture(); link.court!.score = '6-0 6-0'; link.court!.winner_side = 'B'
    const context = validateReviewedCaptainCourt(link, item, identities)!
    expect(reviewedCaptainObservation(context, item)).toMatchObject({ score_text: '6-0 6-0', winner_side: 'A' })
  })
  it('recognizes a reviewed opposite score orientation without treating arbitrary text as equivalent', () => {
    const link = fixture(); link.court!.score = '4-6;3-6'
    expect(reviewedCaptainObservation(validateReviewedCaptainCourt(link, item, identities)!, item).score_text).toBe(item.score_text)
    link.court!.score = '4-6 3-6 unknown'
    expect(reviewedCaptainObservation(validateReviewedCaptainCourt(link, item, identities)!, item).score_text).toBe(link.court!.score)
  })
  it('does no reads for absent source events and fails closed on unavailable review data', async () => {
    const db = { from() { throw new Error('Unexpected read') } } as unknown as SupabaseClient
    expect((await loadReviewedCaptainCourts(db, [])).size).toBe(0)
    const query: object = new Proxy({}, { get(_, name: string) { if (name === 'then') return (resolve: (v: unknown) => void) => resolve({ data: null, error: { message: 'Unavailable' } }); return () => query } })
    await expect(loadReviewedCaptainCourts({ from: () => query } as unknown as SupabaseClient, [item])).rejects.toThrow('Unavailable')
  })
})

describe('reviewed captain reconciliation', () => {
  function database(options: { collision?: boolean; changedPlayer?: boolean; changedWinner?: boolean; existing?: boolean; unlinkedExisting?: boolean; failReviewRead?: boolean } = {}) {
    const writes: { table: string; data: Record<string, unknown> }[] = []
    const link = fixture()
    if (options.changedPlayer) link.court!.match_players[0].player_id = 'changed'
    if (options.changedWinner) link.court!.winner_side = 'B'
    const incoming = { ...item, id: 'incoming', fingerprint: 'fp', source_match_key: 'key' }
    const sourceObservation = { id: 'source-obs', source: 'tennisrecord', source_priority: 100, canonical_match_id: null, score_text: item.score_text, winner_side: item.winner_side, participants: item.participants }
    let localObservation: Record<string, unknown> | null = null
    const service = { from(table: string) {
      const ops: { name: string; args: unknown[] }[] = []
      const operation = (name: string) => ops.find(op => op.name === name)
      const query: object = new Proxy({}, { get(_, name: string) {
        if (name === 'then') return (resolve: (value: unknown) => void, reject: (error: unknown) => void) => Promise.resolve().then(() => {
          if (table === 'matches' || table === 'match_players' || table === 'players') throw new Error('Production result/rating access is forbidden in this path')
          const write = operation('upsert') || operation('update')
          if (write) {
            const data = write.args[0] as Record<string, unknown>; writes.push({ table, data })
            if (table === 'tennisrecord_match_observations') localObservation = { id: 'captain-obs', ...data }
            return { data: [], error: null }
          }
          if (table === 'tennisrecord_reviewed_captain_courts') return options.failReviewRead ? { data: null, error: { message: 'Review read failed' } } : { data: [link], error: null }
          if (table === 'tennisrecord_staged_players') return { data: [{ id: 'sa-id', source_player_key: 'sa' }, { id: 'sb-id', source_player_key: 'sb' }], error: null }
          if (table === 'tennisrecord_player_identities') return { data: [{ staged_player_id: 'sa-id', canonical_player_id: 'a', status: 'matched' }, { staged_player_id: 'sb-id', canonical_player_id: 'b', status: 'matched' }], error: null }
          if (table === 'tennisrecord_canonical_matches') return { data: operation('range') ? [{ fingerprint: 'legacy', winning_source: 'captain_upload' }] : options.existing || options.unlinkedExisting ? { fingerprint: 'fp', canonical_match_id: options.unlinkedExisting ? null : 'court' } : null, error: null }
          if (table === 'tennisrecord_staged_matches') return { data: operation('range') ? [{ id: 'evidence', fingerprint: 'fp', source_url: url }, ...(options.collision ? [{ id: 'collision', fingerprint: 'legacy', source_url: url.replace('123','456') }] : [])] : [incoming], error: null }
          if (table === 'tennisrecord_match_observations') return { data: operation('range') ? [] : [localObservation, sourceObservation].filter(Boolean), error: null }
          throw new Error(`Unexpected table: ${table}`)
        }).then(resolve, reject)
        return (...args: unknown[]) => { ops.push({ name, args }); return query }
      } })
      return query
    } } as unknown as SupabaseClient
    return { service, writes, link }
  }
  it('links a reversed reviewed court and carries the existing processed rating marker without rewriting results', async () => {
    const db = database()
    expect(await reconcileTennisRecordMatches(db.service, ['key'], false)).toEqual({ created: 1, duplicates: 0, conflicts: 0, ratingChanged: false })
    expect(db.writes.map(w => w.table)).toEqual(['tennisrecord_match_observations','tennisrecord_canonical_matches'])
    expect(db.writes[0].data).toMatchObject({ winner_side: 'B', score_text: item.score_text, canonical_match_id: 'court', raw: { originalWinnerSide: 'A', sourceSidesReversed: true } })
    expect(db.writes[1].data).toMatchObject({ canonical_match_id: 'court', winning_source: 'captain_upload', has_conflict: false, rating_processed_at: db.link.rating_processed_at })
  })
  it('recognizes a repeat without resetting its rating status', async () => {
    const db = database({ existing: true })
    expect((await reconcileTennisRecordMatches(db.service, ['key'], false)).duplicates).toBe(1)
    expect(db.writes[1].data).not.toHaveProperty('rating_processed_at')
  })
  it('carries the captain rating marker when a prior source association exists without a played court', async () => {
    const db = database({ unlinkedExisting: true })
    expect((await reconcileTennisRecordMatches(db.service, ['key'], false)).ratingChanged).toBe(false)
    expect(db.writes[1].data).toMatchObject({ canonical_match_id: 'court', rating_processed_at: db.link.rating_processed_at })
  })
  it('keeps a source disagreement visible while preserving the captain winner', async () => {
    const db = database({ changedWinner: true })
    expect((await reconcileTennisRecordMatches(db.service, ['key'], false)).conflicts).toBe(1)
    expect(db.writes[0].data.winner_side).toBe('A')
    expect(db.writes[1].data.has_conflict).toBe(true)
  })
  it.each([{ changedPlayer: true }, { collision: true }])('holds changed players or another source event before association writes (%j)', async options => {
    const db = database(options)
    expect((await reconcileTennisRecordMatches(db.service, ['key'], false)).conflicts).toBe(1)
    expect(db.writes.every(w => ['tennisrecord_staged_matches','tennisrecord_crawl_queue'].includes(w.table))).toBe(true)
  })
  it('aborts a failed reviewed-link read without writing anything', async () => {
    const db = database({ failReviewRead: true })
    await expect(reconcileTennisRecordMatches(db.service, ['key'], false)).rejects.toThrow('Review read failed')
    expect(db.writes).toEqual([])
  })
})
