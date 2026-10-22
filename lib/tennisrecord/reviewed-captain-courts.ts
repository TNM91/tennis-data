import type { SupabaseClient } from '@supabase/supabase-js'
import type { CanonicalParticipant, ProductionMatch } from './production-match-lookup'
import { tennisRecordSourceEventId } from './source-event-identity'

type Person = { sourcePlayerKey?: string; playerId?: string; side: string }
type Snapshot = Record<string, unknown>
export type ReviewedCaptainCourt = {
  source_event_id: string; discipline: string; court_number: number
  canonical_match_id: string; canonical_parent_id: string; source_page_id: string
  source_snapshot: Snapshot; court_snapshot: Snapshot; parent_snapshot: Snapshot
  rating_processed_at: string | null
  court: (ProductionMatch & Snapshot & { match_players: { player_id: string; side: string }[] }) | null
  parent: Snapshot | null
  evidence: { id: string; source_url: string; blocked: boolean; http_status: number } | null
}
export type ReviewedCaptainContext = { link: ReviewedCaptainCourt; match: ProductionMatch; reversed: boolean }
const SOURCE_FIELDS = ['played_on','league_name','flight','home_team','away_team','discipline','court_number']
const COURT_FIELDS = ['id','external_match_id','match_date','league_name','flight','match_type','line_number','facility','source','match_source','status']
const PARENT_FIELDS = ['id','external_match_id','match_date','league_name','flight','home_team','away_team','facility','source','match_source','status']
const equalFields = (a: Snapshot, b: Snapshot, fields: string[]) => fields.every(field => Object.hasOwn(a, field) && Object.hasOwn(b, field) && a[field] === b[field])
const key = (event: string, discipline: unknown, court: unknown) => `${event}|${discipline}|${court}`
export const reviewedCaptainCourtKey = (item: Snapshot) => key(tennisRecordSourceEventId(item.source_url as string) || '', item.discipline, item.court_number)
const personKey = (people: Person[], id: 'sourcePlayerKey' | 'playerId') => people.map(p => `${p.side}:${p[id]}`).sort().join('|')

/** One indexed request per event batch, never per participant or archive scan. */
export async function loadReviewedCaptainCourts(service: SupabaseClient, items: Snapshot[]) {
  const events = [...new Set(items.map(item => tennisRecordSourceEventId(item.source_url as string)).filter((id): id is string => Boolean(id)))]
  const links = new Map<string, ReviewedCaptainCourt>()
  for (let start = 0; start < events.length; start += 50) {
    for (let offset = 0; ; offset += 200) {
      const result = await service.from('tennisrecord_reviewed_captain_courts').select(`*,
        court:matches!canonical_match_id(id,external_match_id,match_date,league_name,flight,match_type,line_number,facility,source,match_source,status,score,winner_side,match_players(player_id,side)),
        parent:matches!canonical_parent_id(id,external_match_id,match_date,league_name,flight,home_team,away_team,facility,source,match_source,status),
        evidence:tennisrecord_source_pages!source_page_id(id,source_url,blocked,http_status)`)
        .in('source_event_id', events.slice(start, start + 50)).order('source_event_id').order('discipline').order('court_number').range(offset, offset + 199)
      if (result.error || !Array.isArray(result.data)) throw new Error(`Could not check reviewed captain links: ${result.error?.message || 'missing response'}`)
      for (const row of result.data as unknown as ReviewedCaptainCourt[]) links.set(key(row.source_event_id, row.discipline, row.court_number), row)
      if (result.data.length < 200) break
    }
  }
  return links
}

/** Changing players, event metadata or a reviewed parent invalidates the link. */
export function validateReviewedCaptainCourt(link: ReviewedCaptainCourt, item: Snapshot, identities: CanonicalParticipant[] | null): ReviewedCaptainContext | null {
  const { court, parent, evidence } = link
  if (!court || !parent || !evidence || evidence.id !== link.source_page_id || evidence.blocked || evidence.http_status < 200 || evidence.http_status >= 300
    || tennisRecordSourceEventId(evidence.source_url) !== link.source_event_id || reviewedCaptainCourtKey(item) !== key(link.source_event_id, link.discipline, link.court_number)
    || court.id !== link.canonical_match_id || parent.id !== link.canonical_parent_id || court.source !== 'captain_scorecard' || parent.source !== 'captain_scorecard'
    || court.status !== 'completed' || parent.status !== 'completed' || !['A','B'].includes(court.winner_side || '')
    || !equalFields(item, link.source_snapshot, SOURCE_FIELDS) || !equalFields(court, link.court_snapshot, COURT_FIELDS) || !equalFields(parent, link.parent_snapshot, PARENT_FIELDS)
    || court.match_date !== item.played_on || parent.match_date !== item.played_on || court.match_type !== item.discipline
    || !court.external_match_id?.startsWith(`${parent.external_match_id}::line:`)) return null
  const source = item.participants as Person[] | undefined
  const expected = link.source_snapshot.participants as Person[] | undefined
  const expectedCourt = link.court_snapshot.participants as Person[] | undefined
  const actual = court.match_players?.map(p => ({ playerId: p.player_id, side: p.side }))
  const size = item.discipline === 'singles' ? 2 : 4
  if (!source || !expected || !identities || !actual || !expectedCourt || [source, expected, identities, actual, expectedCourt].some(p => p.length !== size || p.some(person => !['A','B'].includes(person.side)) || p.filter(person => person.side === 'A').length !== size / 2)
    || new Set(source.map(p => p.sourcePlayerKey)).size !== size || new Set(identities.map(p => p.playerId)).size !== size || new Set(actual.map(p => p.playerId)).size !== size
    || personKey(source, 'sourcePlayerKey') !== personKey(expected, 'sourcePlayerKey')
    || personKey(identities, 'playerId') !== personKey(expected, 'playerId') || personKey(actual, 'playerId') !== personKey(expectedCourt, 'playerId')) return null
  const same = personKey(identities, 'playerId') === personKey(actual, 'playerId')
  const reversed = personKey(identities.map(p => ({ ...p, side: p.side === 'A' ? 'B' : 'A' })), 'playerId') === personKey(actual, 'playerId')
  return same || reversed ? { link, match: court, reversed: !same } : null
}

/** Put the local observation in source-side coordinates; never change the court. */
export function reviewedCaptainObservation(context: ReviewedCaptainContext, item: Snapshot) {
  const match = context.match
  const winner = context.reversed ? match.winner_side === 'A' ? 'B' : 'A' : match.winner_side
  const pairs = (value: string) => {
    const text = value.replace(/\(\d+(?:-\d+)?\)/g, '')
    if (text.replace(/\d+\s*-\s*\d+/g, '').replace(/[\s;,|:]/g, '')) return []
    return [...text.matchAll(/(\d+)\s*-\s*(\d+)/g)].map(m => [Number(m[1]), Number(m[2])])
  }
  const source = pairs(String(item.score_text || '')), local = pairs(match.score || '')
  const scoresAgree = source.length >= 2 && (JSON.stringify(source) === JSON.stringify(local) || JSON.stringify(source.map(([a,b]) => [b,a])) === JSON.stringify(local))
  return { score_text: scoresAgree && winner === item.winner_side ? String(item.score_text) : match.score || '', winner_side: winner,
    raw: { canonicalMatchId: match.id, source: match.source, originalScore: match.score, originalWinnerSide: match.winner_side,
      reviewedSourceEvent: context.link.source_event_id, reviewedSourcePageId: context.link.source_page_id, sourceSidesReversed: context.reversed } }
}
